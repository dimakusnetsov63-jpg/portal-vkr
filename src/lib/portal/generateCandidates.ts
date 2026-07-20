import { COORDINATORS, MANAGERS, PROJECTS, RECRUITERS } from "./constants";
import { TODAY, addDays } from "./format";
import { createRng, pick, randInt } from "./random";
import type { Candidate, StageId } from "./types";

const FIRST_M = ["Иван", "Пётр", "Сергей", "Алексей", "Дмитрий", "Максим", "Артём", "Николай", "Роман", "Игорь", "Владимир", "Егор"];
const FIRST_F = ["Анна", "Мария", "Ольга", "Наталья", "Екатерина", "Юлия", "Виктория", "Дарья", "Полина", "Светлана", "Алина", "Ксения"];
const LAST_M = ["Соколов", "Орлов", "Белов", "Морозов", "Сафин", "Никитин", "Гуров", "Ковалёв", "Быков", "Жуков", "Тарасов", "Фролов"];
const LAST_F = ["Соколова", "Орлова", "Белова", "Морозова", "Сафина", "Никитина", "Гурова", "Ковалёва", "Быкова", "Жукова", "Тарасова", "Фролова"];

const STAGE_ORDER: StageId[] = ["response", "invited", "interview", "processing", "confirmed", "first_shift"];

export function generateCandidates(count = 58): Candidate[] {
  const rnd = createRng(20260720);
  const candidates: Candidate[] = [];

  for (let i = 0; i < count; i++) {
    const isMale = rnd() > 0.5;
    const fio = isMale ? `${pick(rnd, FIRST_M)} ${pick(rnd, LAST_M)}` : `${pick(rnd, FIRST_F)} ${pick(rnd, LAST_F)}`;
    const project = pick(rnd, PROJECTS);
    const city = pick(rnd, project.cities);
    const recruiter = pick(rnd, RECRUITERS);
    const manager = pick(rnd, MANAGERS);
    const coordinator = pick(rnd, COORDINATORS);

    const stageRoll = rnd();
    let stage: StageId;
    if (stageRoll < 0.14) stage = "response";
    else if (stageRoll < 0.3) stage = "invited";
    else if (stageRoll < 0.42) stage = "interview";
    else if (stageRoll < 0.56) stage = "processing";
    else if (stageRoll < 0.64) stage = "confirmed";
    else if (stageRoll < 0.86) stage = "first_shift";
    else if (stageRoll < 0.95) stage = "rejected";
    else stage = "no_show";

    const orderIdx = STAGE_ORDER.indexOf(stage);
    const reached = orderIdx >= 0 ? orderIdx : stage === "rejected" ? randInt(rnd, 0, 3) : randInt(rnd, 1, 3);

    const responseAt = addDays(TODAY, -randInt(rnd, 2, 26));
    responseAt.setHours(randInt(rnd, 9, 18), pick(rnd, [0, 10, 20, 30, 40, 50]));

    let invitedAt: Date | null = null;
    let interviewAt: Date | null = null;
    let processedAt: Date | null = null;
    let firstShiftAt: Date | null = null;
    let cursor = new Date(responseAt);

    if (reached >= 1) {
      cursor = addDays(cursor, randInt(rnd, 0, 2));
      cursor.setHours(randInt(rnd, 9, 18), pick(rnd, [0, 15, 30, 45]));
      invitedAt = new Date(cursor);
    }
    if (reached >= 2) {
      cursor = addDays(cursor, randInt(rnd, 0, 2));
      cursor.setHours(randInt(rnd, 9, 18), pick(rnd, [0, 15, 30, 45]));
      interviewAt = new Date(cursor);
    }
    if (reached >= 3) {
      cursor = addDays(cursor, randInt(rnd, 0, 2));
      cursor.setHours(randInt(rnd, 9, 18), pick(rnd, [0, 15, 30, 45]));
      processedAt = new Date(cursor);
    }
    if (reached >= 5) {
      cursor = addDays(cursor, randInt(rnd, 1, 3));
      cursor.setHours(randInt(rnd, 8, 16), pick(rnd, [0, 15, 30, 45]));
      firstShiftAt = new Date(cursor);
    }

    candidates.push({
      id: `KND-${3100 + i}`,
      fio,
      project: project.id,
      city,
      stage,
      recruiter,
      manager,
      coordinator,
      responseAt,
      invitedAt,
      interviewAt,
      processedAt,
      firstShiftAt,
      comments: [
        {
          who: coordinator,
          at: addDays(responseAt, 1),
          text: "Связались с кандидатом, документы подтверждены.",
        },
      ],
    });
  }

  return candidates;
}
