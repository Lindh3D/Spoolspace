import "reflect-metadata";
import {
  webcrypto,
  randomBytes,
  X509Certificate,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";
import { readFile, writeFile, mkdir, rename, access } from "node:fs/promises";
import { join } from "node:path";
import { hostname, networkInterfaces } from "node:os";
import { isIP } from "node:net";
import * as x509 from "@peculiar/x509";

x509.cryptoProvider.set(webcrypto);
const algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
};
const day = 86400000;
const pem = (type, value) =>
  `-----BEGIN ${type}-----\n${Buffer.from(value)
    .toString("base64")
    .match(/.{1,64}/g)
    .join("\n")}\n-----END ${type}-----\n`;
const serial = () => "01" + randomBytes(15).toString("hex");
async function privatePem(key) {
  return pem("PRIVATE KEY", await webcrypto.subtle.exportKey("pkcs8", key));
}
async function importPrivate(value) {
  return webcrypto.subtle.importKey(
    "pkcs8",
    createPrivateKey(value).export({ type: "pkcs8", format: "der" }),
    algorithm,
    false,
    ["sign"],
  );
}
async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(
      `Cannot read local HTTPS configuration: ${file}. Keep the existing authority files and restore a valid copy.`,
      { cause: error },
    );
  }
}
async function saveJson(file, value) {
  const temporary = file + "." + randomBytes(6).toString("hex") + ".tmp";
  await writeFile(temporary, JSON.stringify(value), {
    mode: 0o600,
    flag: "wx",
  });
  await rename(temporary, file);
}
function keyMatches(cert, key) {
  return cert.publicKey
    .export({ type: "spki", format: "der" })
    .equals(createPublicKey(key).export({ type: "spki", format: "der" }));
}
export function certificateNames({
  computer = hostname(),
  interfaces = networkInterfaces(),
  extra = [],
} = {}) {
  return [
    ...new Set([
      "localhost",
      "127.0.0.1",
      "::1",
      computer.toLowerCase(),
      `${computer.toLowerCase()}.local`,
      ...extra,
      ...Object.values(interfaces)
        .flat()
        .filter(Boolean)
        .map((item) => item.address),
    ]),
  ]
    .filter(
      (name) =>
        typeof name === "string" &&
        !name.includes("%") &&
        (isIP(name) || /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(name)),
    )
    .sort();
}

export async function localHttps({
  dataDir,
  names = certificateNames(),
  now = new Date(),
}) {
  const directory = join(dataDir, "https");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const authorityFile = join(directory, "authority.json");
  let authority = await readJson(authorityFile);
  if (!authority) {
    let publicExists = false;
    try {
      await access(join(directory, "spoolspace-ca.crt"));
      publicExists = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (publicExists)
      throw new Error(
        "The local HTTPS authority key is missing. Restore authority.json; replacing the authority requires trusting it again on your devices.",
      );
    const keys = await webcrypto.subtle.generateKey(algorithm, true, [
      "sign",
      "verify",
    ]);
    const cert = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: serial(),
      name: "CN=Spoolspace Local HTTPS " + randomBytes(4).toString("hex"),
      keys,
      notBefore: new Date(+now - day),
      notAfter: new Date(+now + 3650 * day),
      signingAlgorithm: algorithm,
      extensions: [
        new x509.BasicConstraintsExtension(true, 0, true),
        new x509.KeyUsagesExtension(
          x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign,
          true,
        ),
        await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
      ],
    });
    authority = {
      cert: cert.toString("pem"),
      key: await privatePem(keys.privateKey),
    };
    await saveJson(authorityFile, authority);
  }
  const root = new X509Certificate(authority.cert);
  if (
    !root.ca ||
    !root.verify(root.publicKey) ||
    !keyMatches(root, authority.key) ||
    +new Date(root.validFrom) > +now ||
    +new Date(root.validTo) < +now + day
  )
    throw new Error(
      "The saved local HTTPS authority is invalid or expired. Restore it or explicitly replace it and trust the new authority on your devices.",
    );
  const leafFile = join(directory, "server.json");
  let leaf = await readJson(leafFile);
  let certificate;
  if (leaf) {
    try {
      certificate = new X509Certificate(leaf.cert);
      if (
        !certificate.verify(root.publicKey) ||
        !keyMatches(certificate, leaf.key) ||
        +new Date(certificate.validTo) < +now + 30 * day ||
        +new Date(certificate.validFrom) > +now ||
        names.some((name) =>
          isIP(name)
            ? !certificate.checkIP(name)
            : !certificate.checkHost(name),
        )
      )
        leaf = null;
    } catch {
      leaf = null;
    }
  }
  if (!leaf) {
    const keys = await webcrypto.subtle.generateKey(algorithm, true, [
      "sign",
      "verify",
    ]);
    const cert = await x509.X509CertificateGenerator.create({
      serialNumber: serial(),
      subject: "CN=Spoolspace",
      issuer: new x509.X509Certificate(authority.cert).subject,
      publicKey: keys.publicKey,
      signingKey: await importPrivate(authority.key),
      signingAlgorithm: algorithm,
      notBefore: new Date(+now - day),
      notAfter: new Date(Math.min(+now + 90 * day, +new Date(root.validTo))),
      extensions: [
        new x509.BasicConstraintsExtension(false, undefined, true),
        new x509.KeyUsagesExtension(
          x509.KeyUsageFlags.digitalSignature |
            x509.KeyUsageFlags.keyEncipherment,
          true,
        ),
        new x509.ExtendedKeyUsageExtension(["1.3.6.1.5.5.7.3.1"]),
        new x509.SubjectAlternativeNameExtension(
          names.map((value) => ({ type: isIP(value) ? "ip" : "dns", value })),
        ),
        await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
        await x509.AuthorityKeyIdentifierExtension.create(
          new x509.X509Certificate(authority.cert).publicKey,
        ),
      ],
    });
    leaf = {
      cert: cert.toString("pem"),
      key: await privatePem(keys.privateKey),
    };
    await saveJson(leafFile, leaf);
    certificate = new X509Certificate(leaf.cert);
  }
  // This is the only downloadable certificate: a public root, never a key.
  await writeFile(join(directory, "spoolspace-ca.crt"), root.raw);
  return {
    tls: { cert: leaf.cert, key: leaf.key },
    publicCertificate: root.raw,
    info: {
      mode: "local",
      fingerprint: root.fingerprint256,
      expires: certificate.validTo,
      names,
    },
  };
}

export async function configureHttps({
  dataDir,
  mode = "off",
  certFile = "",
  keyFile = "",
  names,
} = {}) {
  if (!["auto", "off"].includes(mode))
    throw new Error("HTTPS_MODE must be auto or off.");
  if (mode === "off")
    return { tls: null, publicCertificate: null, info: { mode: "off" } };
  if (certFile || keyFile) {
    if (!certFile || !keyFile)
      throw new Error("Set both TLS_CERT_FILE and TLS_KEY_FILE.");
    const [cert, key] = await Promise.all([
      readFile(certFile),
      readFile(keyFile),
    ]);
    const certificate = new X509Certificate(cert);
    if (!keyMatches(certificate, key))
      throw new Error(
        "The configured HTTPS certificate and private key do not match.",
      );
    return {
      tls: { cert, key },
      publicCertificate: null,
      info: {
        mode: "custom",
        fingerprint: certificate.fingerprint256,
        expires: certificate.validTo,
      },
    };
  }
  return localHttps({ dataDir, names });
}
