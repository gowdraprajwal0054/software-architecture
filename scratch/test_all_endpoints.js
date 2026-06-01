const axios = require("axios");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const cls = require("cls-hooked");

const AUTH_URL = "http://localhost:5001";
const PROFESSOR_URL = "http://localhost:5002";
const STUDENT_URL = "http://localhost:5003";
const COURSE_URL = "http://localhost:5004";
const ENROLLMENT_URL = "http://localhost:5005";
const GRADE_URL = "http://localhost:5006";

const privateKey = fs.readFileSync(
  path.join(__dirname, "../authService/routes/auth/keys/private.key"),
  "utf8"
);

// Helper to sign JWTs manually using authService private key
function signToken(payload, role) {
  const tokenPayload = {
    id: payload.id || "test-user-id",
    roles: role ? [role] : ["admin"],
    ...payload,
  };
  return jwt.sign(tokenPayload, privateKey, {
    algorithm: "RS256",
    header: {
      kid: "1",
      jku: "http://localhost:5001/.well-known/jwks.json",
    },
    expiresIn: "1h",
  });
}

// Generate Admin Token
const adminToken = signToken({ id: "admin-id" }, "admin");

// Keep track of created entities for teardown/cleanup
const cleanupQueue = {
  grades: [],
  enrollments: [],
  courses: [],
  students: [],
  professors: [],
};

async function cleanup() {
  console.log("\n--- Starting DB Clean-up Phase ---");
  
  // 1. Delete Grades
  for (const gradeId of cleanupQueue.grades) {
    try {
      await axios.delete(`${GRADE_URL}/api/grades/${gradeId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log(`   [CLEANUP] Deleted Grade ID: ${gradeId}`);
    } catch (e) {
      console.error(`   [CLEANUP ERROR] Failed to delete Grade ID: ${gradeId}: ${e.message}`);
    }
  }

  // 2. Delete Enrollments
  for (const enrollmentId of cleanupQueue.enrollments) {
    try {
      await axios.delete(`${ENROLLMENT_URL}/api/enrollments/${enrollmentId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log(`   [CLEANUP] Deleted Enrollment ID: ${enrollmentId}`);
    } catch (e) {
      console.error(`   [CLEANUP ERROR] Failed to delete Enrollment ID: ${enrollmentId}: ${e.message}`);
    }
  }

  // 3. Delete Courses
  for (const courseId of cleanupQueue.courses) {
    try {
      await axios.delete(`${COURSE_URL}/api/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log(`   [CLEANUP] Deleted Course ID: ${courseId}`);
    } catch (e) {
      console.error(`   [CLEANUP ERROR] Failed to delete Course ID: ${courseId}: ${e.message}`);
    }
  }

  // 4. Delete Students
  for (const studentId of cleanupQueue.students) {
    try {
      await axios.delete(`${STUDENT_URL}/api/students/${studentId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log(`   [CLEANUP] Deleted Student ID: ${studentId}`);
    } catch (e) {
      console.error(`   [CLEANUP ERROR] Failed to delete Student ID: ${studentId}: ${e.message}`);
    }
  }

  // 5. Delete Professors
  for (const profId of cleanupQueue.professors) {
    try {
      await axios.delete(`${PROFESSOR_URL}/api/professors/${profId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log(`   [CLEANUP] Deleted Professor ID: ${profId}`);
    } catch (e) {
      console.error(`   [CLEANUP ERROR] Failed to delete Professor ID: ${profId}: ${e.message}`);
    }
  }
}

async function runTests() {
  console.log("=== STARTING COMPREHENSIVE microservice TESTING ===\n");

  try {
    // ==========================================
    // PART 1: Programmatic Logging & Correlation ID Tests
    // ==========================================
    console.log("Part 1: Verifying Programmatic Winston Logging & Correlation ID Format...");
    
    const originalWrite = process.stdout.write;
    let logOutput = "";
    process.stdout.write = (chunk, encoding, callback) => {
      logOutput += chunk.toString();
      return originalWrite.call(process.stdout, chunk, encoding, callback);
    };

    require("../correlationId");
    const cls = require("cls-hooked");
    const namespace = cls.getNamespace("app-namespace");
    
    namespace.run(() => {
      namespace.set("correlationId", "test-log-correlation-id-999");
      const { professorServiceLogger } = require("../logging");
      professorServiceLogger.info("Test correlation log string");
    });

    process.stdout.write = originalWrite;

    // Verify stdout format and correlationId
    const logLines = logOutput.split("\n").filter(line => line.trim() !== "");
    const matchingLogLine = logLines.find(line => line.includes("Test correlation log string"));
    
    if (!matchingLogLine) {
      throw new Error("Logger did not output matching log line to stdout");
    }

    const logJson = JSON.parse(matchingLogLine);
    if (logJson.correlationId !== "test-log-correlation-id-999") {
      throw new Error(`Logger output did not propagate correlationId. Found: ${logJson.correlationId}`);
    }
    if (!logJson.timestamp || logJson.level !== "info" || logJson.message !== "Test correlation log string") {
      throw new Error("Logger output JSON fields are malformed");
    }
    console.log("   [SUCCESS] Winston JSON format and local Correlation ID verified in console output.\n");


    // ==========================================
    // PART 2: HTTP Correlation ID Propagation
    // ==========================================
    console.log("Part 2: Testing HTTP Correlation ID propagation...");
    
    // 2.1 Send with custom header
    const customCorrId = "custom-id-xyz-777";
    const customRes = await axios.get(`${AUTH_URL}/.well-known/jwks.json`, {
      headers: { "x-correlation-id": customCorrId }
    });
    const returnedCorrId = customRes.headers["x-correlation-id"];
    if (returnedCorrId !== customCorrId) {
      throw new Error(`Sent correlation ID '${customCorrId}' but received '${returnedCorrId}'`);
    }
    console.log("   [SUCCESS] Custom correlation ID propagated to response headers.");

    // 2.2 Send without custom header (should generate a UUID)
    const emptyRes = await axios.get(`${AUTH_URL}/.well-known/jwks.json`);
    const generatedCorrId = emptyRes.headers["x-correlation-id"];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(generatedCorrId)) {
      throw new Error(`Expected a generated UUID in response header x-correlation-id but got: ${generatedCorrId}`);
    }
    console.log(`   [SUCCESS] Auto-generated UUID correlation ID verified: ${generatedCorrId}`);

    // 2.3 Verify propagation in error responses
    // We will attempt to call a route that triggers an error and assert that the correlation ID is propagated in headers and body (if present)
    const errCorrId = "err-propagation-id-456";
    try {
      await axios.post(`${GRADE_URL}/api/grades`, {
        student: "6a1eb7ff495083d72dd48e99",
        course: "6a1eb7ff324f99b1a1355099",
        grade: "A"
      }, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "x-correlation-id": errCorrId
        }
      });
      throw new Error("Falsely succeeded in grading non-existent student");
    } catch (e) {
      if (e.response) {
        const returnedErrId = e.response.headers["x-correlation-id"];
        if (returnedErrId !== errCorrId) {
          throw new Error(`Expected correlation ID in error response headers to be '${errCorrId}' but got '${returnedErrId}'`);
        }
        console.log(`   [SUCCESS] Error response headers (Status ${e.response.status}) contained correct correlation ID: ${returnedErrId}`);
        
        if (e.response.data && e.response.data.correlationId) {
          if (e.response.data.correlationId !== errCorrId) {
            throw new Error(`Expected correlation ID in error response body to be '${errCorrId}' but got '${e.response.data.correlationId}'`);
          }
          console.log("   [SUCCESS] Error response body JSON contained matching correlationId.");
        }
      } else {
        throw e;
      }
    }
    console.log();


    // ==========================================
    // PART 3: Full API CRUD and RBAC Verification
    // ==========================================
    console.log("Part 3: Testing REST API CRUD and Role-Based Access Control...");

    const rand = Math.floor(Math.random() * 1000000);
    const profEmail = `prof_test_${rand}@university.edu`;
    const profPhone = `555-${rand}`;
    const prof2Email = `prof2_test_${rand}@university.edu`;
    const prof2Phone = `555-2-${rand}`;
    const studentEmail = `stud_test_${rand}@university.edu`;
    const student2Email = `stud2_test_${rand}@university.edu`;

    let profId, profToken;
    let prof2Id, prof2Token;
    let studentId, studentToken;
    let student2Id, student2Token;
    let courseId, enrollmentId, gradeId;

    // --- Professor Service Tests ---
    console.log("\n3.1 Testing Professor Endpoints & Sign-up/Login...");
    
    // Create Professor 1 (Public Signup)
    const profRes = await axios.post(`${PROFESSOR_URL}/api/professors`, {
      name: "Professor Albert",
      email: profEmail,
      phone: profPhone,
      password: "profpassword123",
    });
    profId = profRes.data.professor._id;
    cleanupQueue.professors.push(profId);
    console.log(`   [SUCCESS] Created Professor 1 with ID: ${profId}`);

    // Create Professor 2 (Public Signup)
    const prof2Res = await axios.post(`${PROFESSOR_URL}/api/professors`, {
      name: "Professor Niels",
      email: prof2Email,
      phone: prof2Phone,
      password: "profpassword123",
    });
    prof2Id = prof2Res.data.professor._id;
    cleanupQueue.professors.push(prof2Id);
    console.log(`   [SUCCESS] Created Professor 2 with ID: ${prof2Id}`);

    // Login Professor 1
    const profLoginRes = await axios.post(`${AUTH_URL}/api/login/professor`, {
      email: profEmail,
      password: "profpassword123",
    });
    profToken = profLoginRes.data.access_token;
    console.log("   [SUCCESS] Professor 1 logged in. Token acquired.");

    // Login Professor 2
    const prof2LoginRes = await axios.post(`${AUTH_URL}/api/login/professor`, {
      email: prof2Email,
      password: "profpassword123",
    });
    prof2Token = prof2LoginRes.data.access_token;
    console.log("   [SUCCESS] Professor 2 logged in. Token acquired.");

    // RBAC check: GET /api/professors
    const allProfs = await axios.get(`${PROFESSOR_URL}/api/professors`, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    if (!Array.isArray(allProfs.data)) throw new Error("GET /api/professors did not return an array");
    console.log("   [SUCCESS] GET /api/professors accessed successfully as Professor.");

    // Profile retrieval and restriction check: GET /api/professors/:id
    // Own profile should succeed
    const ownProfProfile = await axios.get(`${PROFESSOR_URL}/api/professors/${profId}`, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    if (ownProfProfile.data.email !== profEmail) throw new Error("Incorrect email returned for own profile");
    console.log("   [SUCCESS] Retrieve own professor profile succeeded.");

    // Other profile should fail (403)
    try {
      await axios.get(`${PROFESSOR_URL}/api/professors/${profId}`, {
        headers: { Authorization: `Bearer ${prof2Token}` } // Prof 2 requesting Prof 1 profile
      });
      throw new Error("Falsely allowed access to other professor's profile");
    } catch (e) {
      if (e.response && e.response.status === 403) {
        console.log("   [SUCCESS] Correctly blocked professor from viewing another professor's profile.");
      } else throw e;
    }

    // Profile PUT check: update own profile details
    const updateProfRes = await axios.put(`${PROFESSOR_URL}/api/professors/${profId}`, {
      name: "Professor Albert Einstein"
    }, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    if (updateProfRes.data.professor.name !== "Professor Albert Einstein") {
      throw new Error("Professor profile update failed to save name");
    }
    console.log("   [SUCCESS] Professor own profile update succeeded.");


    // --- Student Service Tests ---
    console.log("\n3.2 Testing Student Endpoints & Sign-up/Login...");
    
    // Create Student 1 (Requires Professor or Admin)
    // Student creation without token should fail
    try {
      await axios.post(`${STUDENT_URL}/api/students`, {
        name: "Max Planck",
        email: studentEmail,
        password: "studentpassword123"
      });
      throw new Error("Falsely allowed public signup of students");
    } catch (e) {
      if (e.response && e.response.status === 401) {
        console.log("   [SUCCESS] Student creation blocked for public (unauthorized).");
      } else throw e;
    }

    // Student 1 creation (by Professor 1)
    const studRes = await axios.post(`${STUDENT_URL}/api/students`, {
      name: "Max Planck",
      email: studentEmail,
      password: "studentpassword123"
    }, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    studentId = studRes.data._id;
    cleanupQueue.students.push(studentId);
    console.log(`   [SUCCESS] Student 1 created by Prof 1. ID: ${studentId}`);

    // Student 2 creation (by Admin)
    const stud2Res = await axios.post(`${STUDENT_URL}/api/students`, {
      name: "Werner Heisenberg",
      email: student2Email,
      password: "studentpassword123"
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    student2Id = stud2Res.data._id;
    cleanupQueue.students.push(student2Id);
    console.log(`   [SUCCESS] Student 2 created by Admin. ID: ${student2Id}`);

    // Login Student 1
    const studLoginRes = await axios.post(`${AUTH_URL}/api/login/student`, {
      email: studentEmail,
      password: "studentpassword123"
    });
    studentToken = studLoginRes.data.access_token;
    console.log("   [SUCCESS] Student 1 logged in. Token acquired.");

    // Login Student 2
    const stud2LoginRes = await axios.post(`${AUTH_URL}/api/login/student`, {
      email: student2Email,
      password: "studentpassword123"
    });
    student2Token = stud2LoginRes.data.access_token;
    console.log("   [SUCCESS] Student 2 logged in. Token acquired.");

    // Own Profile retrieval: Student 1 GET own
    const ownStudProfile = await axios.get(`${STUDENT_URL}/api/students/${studentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (ownStudProfile.data.email !== studentEmail) throw new Error("Incorrect student own email returned");
    console.log("   [SUCCESS] Student own profile retrieval succeeded.");

    // Block cross student profile retrieval (403)
    try {
      await axios.get(`${STUDENT_URL}/api/students/${studentId}`, {
        headers: { Authorization: `Bearer ${student2Token}` }
      });
      throw new Error("Falsely allowed student 2 to read student 1 profile");
    } catch (e) {
      if (e.response && e.response.status === 403) {
        console.log("   [SUCCESS] Correctly blocked student 2 from reading student 1 profile.");
      } else throw e;
    }


    // --- Course Service Tests ---
    console.log("\n3.3 Testing Course Endpoints...");
    
    // Create Course (Professor 1)
    const courseRes = await axios.post(`${COURSE_URL}/api/courses`, {
      name: "Quantum Mechanics I",
      code: `PHYS-${rand}`,
      description: "Foundations of modern quantum theory.",
      schedule: { days: ["Tuesday", "Thursday"], time: "2:00 PM - 4:00 PM" }
    }, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    courseId = courseRes.data._id;
    cleanupQueue.courses.push(courseId);
    console.log(`   [SUCCESS] Created Course by Prof 1 with ID: ${courseId}`);

    // Retrieve Course (Public verification via token)
    const courseDetail = await axios.get(`${COURSE_URL}/api/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    if (courseDetail.data.name !== "Quantum Mechanics I") throw new Error("Failed to fetch correct course details");
    console.log("   [SUCCESS] Course details fetched correctly.");

    // Update Course (Prof 2 trying to update Prof 1 course: should be blocked)
    try {
      await axios.put(`${COURSE_URL}/api/courses/${courseId}`, {
        name: "Malicious Course Title Override"
      }, {
        headers: { Authorization: `Bearer ${prof2Token}` }
      });
      throw new Error("Falsely allowed professor 2 to edit professor 1's course");
    } catch (e) {
      if (e.response && e.response.status === 403) {
        console.log("   [SUCCESS] Correctly blocked other professor from modifying course.");
      } else throw e;
    }

    // Update Course (Prof 1 updating own course: should succeed)
    const updateCourseRes = await axios.put(`${COURSE_URL}/api/courses/${courseId}`, {
      name: "Quantum Mechanics 101"
    }, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    if (updateCourseRes.data.name !== "Quantum Mechanics 101") throw new Error("Course update failed to save name");
    console.log("   [SUCCESS] Creator professor successfully updated course.");


    // --- Enrollment Service Tests ---
    console.log("\n3.4 Testing Enrollment Endpoints...");

    // Enroll Student 1 in Course (Prof 1)
    const enrollRes = await axios.post(`${ENROLLMENT_URL}/api/enrollments`, {
      student: studentId,
      course: courseId
    }, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    enrollmentId = enrollRes.data._id;
    cleanupQueue.enrollments.push(enrollmentId);
    console.log(`   [SUCCESS] Enrolled Student 1 in course. Enrollment ID: ${enrollmentId}`);

    // Verify duplicate enrollment block (409)
    try {
      await axios.post(`${ENROLLMENT_URL}/api/enrollments`, {
        student: studentId,
        course: courseId
      }, {
        headers: { Authorization: `Bearer ${profToken}` }
      });
      throw new Error("Falsely allowed duplicate enrollment");
    } catch (e) {
      if (e.response && e.response.status === 409) {
        console.log("   [SUCCESS] Correctly blocked duplicate enrollment (409).");
      } else throw e;
    }

    // Verify GET /api/enrollments/student/:id (Own enrollments)
    const studentEnrollments = await axios.get(`${ENROLLMENT_URL}/api/enrollments/student/${studentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (studentEnrollments.data[0]._id !== enrollmentId) throw new Error("Incorrect enrollment list retrieved");
    console.log("   [SUCCESS] Student successfully fetched own enrollments list.");


    // --- Grade Service Tests ---
    console.log("\n3.5 Testing Grade Endpoints & Resolving Course details...");

    // Non-creator Professor grading Student 1 (Should be blocked 403)
    try {
      await axios.post(`${GRADE_URL}/api/grades`, {
        student: studentId,
        course: courseId,
        grade: "A-"
      }, {
        headers: { Authorization: `Bearer ${prof2Token}` }
      });
      throw new Error("Falsely allowed non-creator professor to grade course");
    } catch (e) {
      if (e.response && e.response.status === 403) {
        console.log("   [SUCCESS] Correctly blocked non-creator professor from submitting grade.");
      } else throw e;
    }

    // Creator Professor 1 grading Student 2 who is NOT enrolled (Should fail 409)
    try {
      await axios.post(`${GRADE_URL}/api/grades`, {
        student: student2Id,
        course: courseId,
        grade: "A+"
      }, {
        headers: { Authorization: `Bearer ${profToken}` }
      });
      throw new Error("Falsely allowed grading of non-enrolled student");
    } catch (e) {
      if (e.response && e.response.status === 409) {
        console.log("   [SUCCESS] Correctly blocked grading of non-enrolled student (409).");
      } else throw e;
    }

    // Creator Professor 1 grading Student 1 who IS enrolled (Should succeed)
    const gradeRes = await axios.post(`${GRADE_URL}/api/grades`, {
      student: studentId,
      course: courseId,
      grade: "A+",
      remarks: "Brilliant insights on wave functions!"
    }, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    gradeId = gradeRes.data._id;
    cleanupQueue.grades.push(gradeId);
    console.log(`   [SUCCESS] Grade assigned successfully. Grade ID: ${gradeId}`);

    // Retrieve Grades as Student 1 (Rich Grades list with resolved course details)
    const studentGrades = await axios.get(`${GRADE_URL}/api/grades/student/${studentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const assignedGrade = studentGrades.data.find(g => g._id === gradeId);
    if (!assignedGrade || assignedGrade.grade !== "A+" || assignedGrade.course.name !== "Quantum Mechanics 101") {
      throw new Error("Retrieved grades did not contain correctly resolved rich course details");
    }
    console.log(`   [SUCCESS] Student rich grade retrieval verified. Resolved Course: "${assignedGrade.course.name}"`);

    // Student 2 trying to retrieve Student 1's grades (Should be blocked 403)
    try {
      await axios.get(`${GRADE_URL}/api/grades/student/${studentId}`, {
        headers: { Authorization: `Bearer ${student2Token}` }
      });
      throw new Error("Falsely allowed student 2 to access student 1's grades");
    } catch (e) {
      if (e.response && e.response.status === 403) {
        console.log("   [SUCCESS] Correctly blocked student 2 from reading student 1's grades.");
      } else throw e;
    }

    // Prof 1 updating grade (Should succeed)
    const gradeUpdateRes = await axios.put(`${GRADE_URL}/api/grades/${gradeId}`, {
      grade: "A",
      remarks: "Excellent work."
    }, {
      headers: { Authorization: `Bearer ${profToken}` }
    });
    if (gradeUpdateRes.data.grade !== "A" || gradeUpdateRes.data.remarks !== "Excellent work.") {
      throw new Error("Grade update failed to save");
    }
    console.log("   [SUCCESS] Creator professor successfully updated grade.");

    // Prof 2 trying to update Prof 1 grade (Should be blocked 403)
    try {
      await axios.put(`${GRADE_URL}/api/grades/${gradeId}`, {
        grade: "F"
      }, {
        headers: { Authorization: `Bearer ${prof2Token}` }
      });
      throw new Error("Falsely allowed different professor to update grade");
    } catch (e) {
      if (e.response && e.response.status === 403) {
        console.log("   [SUCCESS] Correctly blocked different professor from updating grade.");
      } else throw e;
    }

    console.log("\n=== ALL SYSTEM BEHAVIORS, LOGS, CORRELATION IDS & ENDPOINTS VERIFIED! ===");

  } catch (error) {
    console.error("\n[CRITICAL FAILURE] Test flow failed on an assertion:");
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error("   Response Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.stack || error.message);
    }
    await cleanup();
    process.exit(1);
  }

  // Clean-up phase
  await cleanup();
  console.log("\n=== TEST COMPLETED SUCCESSFULLY! ===");
  process.exit(0);
}

runTests();
