/**
 * generateShareableCard — draws a dark-themed prediction card on a canvas,
 * returns a data-URL PNG that can be downloaded or shared.
 */
const COLORS = {
  bg:     "#0d1220",
  card:   "#131b2e",
  blue:   "#3b82f6",
  violet: "#8b5cf6",
  green:  "#34d399",
  orange: "#fb923c",
  red:    "#f87171",
  white:  "#f1f5f9",
  muted:  "#94a3b8",
  dim:    "#475569",
};

const PRED_META = {
  Pass:      { emoji: "\uD83C\uDF93", color: COLORS.green },
  Fail:      { emoji: "\uD83D\uDCC9", color: COLORS.orange },
  "At-Risk": { emoji: "\u26A0\uFE0F", color: COLORS.red },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function generateShareableDataURL(result, name) {
  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // subtle radial glow
  const predMeta = PRED_META[result.prediction] || PRED_META.Pass;
  const grd = ctx.createRadialGradient(W / 2, 380, 30, W / 2, 380, 420);
  grd.addColorStop(0, predMeta.color + "22");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // top bar accent
  ctx.fillStyle = predMeta.color;
  ctx.fillRect(0, 0, W, 6);

  // branding
  ctx.fillStyle = COLORS.muted;
  ctx.font = "bold 26px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ACADEMICAi", W / 2, 70);

  // emoji
  ctx.font = "120px 'Segoe UI Emoji', system-ui, sans-serif";
  ctx.fillText(predMeta.emoji, W / 2, 200);

  // prediction label
  ctx.fillStyle = COLORS.dim;
  ctx.font = "24px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("YOUR PREDICTION", W / 2, 270);

  // prediction text
  ctx.fillStyle = predMeta.color;
  ctx.font = "bold 80px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(result.prediction, W / 2, 370);

  // confidence
  ctx.fillStyle = COLORS.white;
  ctx.font = "36px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText(`${result.confidence}% confidence`, W / 2, 430);

  // score bars
  const scores = Object.entries(result.confidence_scores || {});
  const barColors = { Pass: COLORS.green, Fail: COLORS.orange, "At-Risk": COLORS.red };
  const barW = 600, barH = 32, barX = (W - barW) / 2;
  let barY = 500;

  // card background
  roundRect(ctx, barX - 40, barY - 30, barW + 80, scores.length * 72 + 30, 20);
  ctx.fillStyle = COLORS.card;
  ctx.fill();

  ctx.textAlign = "left";
  scores.forEach(([label, pct]) => {
    ctx.fillStyle = COLORS.white;
    ctx.font = "bold 26px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(label, barX, barY + 22);

    // bar track
    roundRect(ctx, barX + 150, barY + 4, barW - 150, barH, 10);
    ctx.fillStyle = COLORS.bg;
    ctx.fill();

    // bar fill
    const fillW = Math.max(4, ((barW - 150) * pct) / 100);
    roundRect(ctx, barX + 150, barY + 4, fillW, barH, 10);
    ctx.fillStyle = barColors[label] || COLORS.blue;
    ctx.fill();

    // percentage
    ctx.fillStyle = COLORS.muted;
    ctx.font = "22px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${pct}%`, barX + barW + 30, barY + 24);
    ctx.textAlign = "left";

    barY += 72;
  });

  // model info
  ctx.fillStyle = COLORS.dim;
  ctx.font = "22px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `Random Forest · ${result.dataset_size || 395} students · ${result.model_accuracy || "81.0%"}`,
    W / 2,
    barY + 70
  );

  // footer
  ctx.fillStyle = COLORS.dim;
  ctx.font = "20px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("Check your score → academicai.vercel.app", W / 2, H - 50);

  // optional name
  if (name) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = "italic 22px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText(`Predicted for ${name}`, W / 2, H - 90);
  }

  return canvas.toDataURL("image/png");
}

export function downloadShareableCard(result, name) {
  const dataURL = generateShareableDataURL(result, name);
  const link = document.createElement("a");
  link.download = `AcademicAI-${result.prediction.replace(/\s+/g, "")}.png`;
  link.href = dataURL;
  link.click();
}