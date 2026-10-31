// Representative public spoolData schema inspected on prusament.com. The test
// ID is synthetic and tests never contact the manufacturer's website.
export const prusaURL = "https://prusament.com/spool/?spoolId=abc123ff";
export const prusaData = {
  sample: false,
  country: "CZ",
  weight: 866,
  spool_weight: 186,
  length: 346,
  manufacture_date: "2025-04-05T10:10:56+02:00",
  filament: {
    color_name: "Signal White",
    color_rgb: "#e3dfd9",
    material: "ASA",
    name: "Prusament ASA Signal White 850g - v1",
    he_min: 250,
    he_max: 270,
    hb_min: 100,
    hb_max: 120,
  },
};
export const prusaHTML = (data = prusaData) =>
  `<html><script>var spoolData = '${JSON.stringify(data)}';</script></html>`;
export const noisyPrusaLabel =
  "D {iz E] ASA Signal White =\nBr HEAT: ID: abc123ff 5.4.2025\nSCimar Nozzle: 260 +10 °C |\n] His Heatbed: 10 £10 °C |\nf&] ® 6 0 oo Q&\nJCS $6 0 oo |";
