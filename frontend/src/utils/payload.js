export const GRADE_MAP = { "0-2":1, "3-4":3.5, "5-6":5.5, "7-8":7.5, "9-10":9.5 };
export const ABS_MAP   = { "above90":2, "75-90":8, "60-75":18, "below60":30 };

export function buildPayload(a) {
  const sem = parseInt(a.currentSem) || 1;
  let g1Raw, g2Raw;
  if (sem === 1) {
    g1Raw = a.interGrade || "5-6";
    g2Raw = a.interGrade || "5-6";
  } else {
    g1Raw = a.G1 || "5-6";
    g2Raw = a.G2 || a.G1 || "5-6";
  }
  return {
    sex: a.sex || "M",
    age: parseInt(a.age) || 19,
    address: a.address || "U",
    famsize: "GT3", Pstatus: "T",
    Medu: parseInt(a.Medu) || 2,
    Fedu: parseInt(a.Fedu) || 2,
    Mjob: "other", Fjob: "other",
    reason: "course", guardian: "mother", traveltime: 1,
    studytime: parseInt(a.studytime) || 2,
    failures: parseInt(a.failures) || 0,
    schoolsup: a.schoolsup || "no",
    famsup: a.famsup || "yes",
    paid: "no", activities: "no", nursery: "yes",
    higher: "yes", internet: a.internet || "yes",
    romantic: "no", famrel: 4, freetime: 3, goout: 3, Dalc: 1, Walc: 1,
    health: parseInt(a.health) || 3,
    absences: ABS_MAP[a.attendance] ?? 8,
    G1: Math.round((GRADE_MAP[g1Raw] ?? 7.5) * 2),
    G2: Math.round((GRADE_MAP[g2Raw] ?? 7.5) * 2),
  };
}