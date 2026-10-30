import express from "express";
import { z } from "zod";

import { checkPassword } from "./auth.service.ts";
import { TranscriptDB } from "./transcript.service.ts";
import type { Transcript } from "./types.ts";

export const app = express();
app.use(express.json());
const db = new TranscriptDB();

/* Handle API requests to create a new student record */
const zAddStudentBody = z.object({
  password: z.string(),
  studentName: z.string(),
});
app.post("/api/addStudent", (req, res) => {
  const body = zAddStudentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
  } else if (!checkPassword(body.data.password)) {
    res.status(403).send({ error: "Invalid credentials" });
  } else {
    const id = db.addStudent(body.data.studentName);
    res.send({ studentID: id });
  }
});

/* Handle API requests to add a grade to a student */
const zAddGradeBody = z.object({
  password: z.string(),
  studentID: z.int().gte(0),
  courseName: z.string(),
  courseGrade: z.number().gte(0).lte(100),
});
app.post("/api/addGrade", (req, res) => {
  const body = zAddGradeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
  } else if (!checkPassword(body.data.password)) {
    res.status(403).send({ error: "Invalid credentials" });
  } else {
    let response: { success: true } | { success: false };
    try {
      db.addGrade(body.data.studentID, body.data.courseName, body.data.courseGrade);
      response = { success: true };
    } catch {
      response = { success: false };
    }
    res.send(response);
  }
});

/* Handle API requests to retrieve a student transcript */
const zGetTranscriptBody = z.object({
  password: z.string(),
  studentID: z.int().gte(0),
});
app.post("/api/getTranscript", (req, res) => {
  const body = zGetTranscriptBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
  } else if (!checkPassword(body.data.password)) {
    res.status(403).send({ error: "Invalid credentials" });
  } else {
    let response: { success: true; transcript: Transcript } | { success: false };
    try {
      const transcript = db.getTranscript(body.data.studentID);
      response = { success: true, transcript };
    } catch {
      response = { success: false };
    }
    res.send(response);
  }
});
