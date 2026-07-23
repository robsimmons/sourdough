import "./style.css";

import { addGrade, addStudent, getTranscript, serviceErrorToStr } from "./service.ts";

const showNewStudentDiv = document.querySelector<HTMLDivElement>("#showNewStudent")!;
document.querySelector<HTMLFormElement>("#addStudent")!.onsubmit = (ev) => {
  ev.preventDefault();
  const password = document.querySelector<HTMLInputElement>("#password")!.value.trim();
  const studentName = document.querySelector<HTMLInputElement>("#studentName")!.value.trim();
  addStudent(password, studentName)
    .then(({ studentID }) => {
      showNewStudentDiv.innerText = `Record created for student '${studentName}' with ID ${studentID}`;
    })
    .catch((err: unknown) => {
      showNewStudentDiv.innerText = serviceErrorToStr(err);
    });
};

const showAddGradeDiv = document.querySelector<HTMLDivElement>("#showAddGrade")!;
document.querySelector<HTMLFormElement>("#addGrade")!.onsubmit = (ev) => {
  ev.preventDefault();
  const password = document.querySelector<HTMLInputElement>("#password")!.value.trim();
  const studentID = document.querySelector<HTMLInputElement>("#studentIdForAddGrade")!.value.trim();
  const courseName = document.querySelector<HTMLInputElement>("#addGradeCourse")!.value.trim();
  const courseGrade = document.querySelector<HTMLInputElement>("#addGradeGrade")!.value.trim();
  addGrade(password, studentID, courseName, courseGrade)
    .then(() => {
      showAddGradeDiv.innerText = `Added grade of ${courseGrade} in ${courseName} successfully!`;
    })
    .catch((err: unknown) => {
      showAddGradeDiv.innerText = serviceErrorToStr(err);
    });
};

const showGetTranscriptDiv = document.querySelector<HTMLDivElement>("#showTranscript")!;
document.querySelector<HTMLFormElement>("#viewTranscript")!.onsubmit = (ev) => {
  ev.preventDefault();
  const password = document.querySelector<HTMLInputElement>("#password")!.value.trim();
  const studentID = document.querySelector<HTMLInputElement>("#idToView")!.value.trim();
  getTranscript(password, studentID)
    .then((result) => {
      if (!result.success) {
        showGetTranscriptDiv.innerText = `No student exists with id ${studentID}`;
      } else {
        const { student, grades } = result.transcript;
        showGetTranscriptDiv.innerText = `Transcript for student ${student.studentName} (id ${student.studentID})`;
        const list = document.createElement("ul");
        showGetTranscriptDiv.append(list);
        for (const record of grades) {
          const item = document.createElement("li");
          item.innerText = `${record.grade} in ${record.course}`;
          list.append(item);
        }
      }
    })
    .catch((err: unknown) => {
      showGetTranscriptDiv.innerText = serviceErrorToStr(err);
    });
};
