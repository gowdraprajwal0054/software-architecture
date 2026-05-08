const AUTH_SERVICE = "http://localhost:5001/api/login";

const PROFESSOR__SERVICE = "http://localhost:5002/api/professors";

const STUDENT_SERVICE = "http://localhost:5003/api/students";

const COURSE_SERVICE = "http://localhost:5004/api/courses";

// roles.js
const ROLES = Object.freeze({
  STUDENT: "student",
  PROFESSOR: "professor",
  ADMIN: "admin",
  AUTH_SERVICE: "auth_service",
  ENROLLMENT_SERVICE: "enrollment_service",
});

module.exports = {
  AUTH_SERVICE,
  STUDENT_SERVICE,
  PROFESSOR__SERVICE,
  COURSE_SERVICE,
  ROLES,
};
