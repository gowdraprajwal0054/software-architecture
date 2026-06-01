const axios = require("axios");

const AUTH_URL = "http://localhost:5001/api/login";
const PROFESSOR_URL = "http://localhost:5002/api/professors";
const STUDENT_URL = "http://localhost:5003/api/students";
const COURSE_URL = "http://localhost:5004/api/courses";
const ENROLLMENT_URL = "http://localhost:5005/api/enrollments";
const GRADE_URL = "http://localhost:5006/api/grades";

async function runTests() {
  console.log("=== STARTING ARCHITECTURE INTEGRATION TESTS ===\n");

  const rand = Math.floor(Math.random() * 1000000);
  const profEmail = `prof_${rand}@university.edu`;
  const profPhone = `555-${rand}`;
  const studentEmail = `student_${rand}@university.edu`;

  let profToken, studentToken;
  let profId, studentId, courseId, enrollmentId, gradeId;

  try {
    // 1. Create a Professor (Public signup)
    console.log("1. Creating Professor...");
    const profRes = await axios.post(PROFESSOR_URL, {
      name: "Professor Xavier",
      email: profEmail,
      phone: profPhone,
      password: "profpassword123",
    });
    profId = profRes.data.professor._id;
    console.log(`   [SUCCESS] Professor created with ID: ${profId}`);

    // 2. Login Professor
    console.log("2. Logging in Professor...");
    const profLoginRes = await axios.post(`${AUTH_URL}/professor`, {
      email: profEmail,
      password: "profpassword123",
    });
    profToken = profLoginRes.data.access_token;
    console.log(`   [SUCCESS] Professor logged in. Token acquired.`);

    // 3. Create a Student (Requires Professor or Admin token)
    console.log("3. Creating Student...");
    const studentRes = await axios.post(
      STUDENT_URL,
      {
        name: "Peter Parker",
        email: studentEmail,
        password: "studentpassword123",
      },
      {
        headers: { Authorization: `Bearer ${profToken}` },
      }
    );
    studentId = studentRes.data._id;
    console.log(`   [SUCCESS] Student created with ID: ${studentId}`);

    // 4. Login Student
    console.log("4. Logging in Student...");
    const studentLoginRes = await axios.post(`${AUTH_URL}/student`, {
      email: studentEmail,
      password: "studentpassword123",
    });
    studentToken = studentLoginRes.data.access_token;
    console.log(`   [SUCCESS] Student logged in. Token acquired.`);

    // 5. Create a Course (Requires Professor token)
    console.log("5. Creating a Course...");
    const courseRes = await axios.post(
      COURSE_URL,
      {
        name: "Intro to Web Engineering",
        code: `WEB-${rand}`,
        description: "Learn advanced microservice architecture patterns.",
        schedule: { days: ["Monday", "Wednesday"], time: "10:00 AM - 12:00 PM" },
      },
      {
        headers: { Authorization: `Bearer ${profToken}` },
      }
    );
    courseId = courseRes.data._id;
    console.log(`   [SUCCESS] Course created with ID: ${courseId}`);

    // 6. Enroll Student in Course (Requires Professor/Admin token)
    console.log("6. Enrolling Student in Course...");
    const enrollRes = await axios.post(
      ENROLLMENT_URL,
      {
        student: studentId,
        course: courseId,
      },
      {
        headers: { Authorization: `Bearer ${profToken}` },
      }
    );
    enrollmentId = enrollRes.data._id;
    console.log(`   [SUCCESS] Student enrolled with ID: ${enrollmentId}`);

    // 7. Test Security Constraint: Student cannot assign grades (Should fail)
    console.log("7. Testing Security Constraint: Student trying to assign a grade...");
    try {
      await axios.post(
        GRADE_URL,
        {
          student: studentId,
          course: courseId,
          grade: "A",
          remarks: "Excellent web microservices design!",
        },
        {
          headers: { Authorization: `Bearer ${studentToken}` },
        }
      );
      console.error("   [FAILURE] Student was able to assign a grade!");
      process.exit(1);
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log("   [SUCCESS] Correctly blocked student from assigning grade (403).");
      } else {
        console.error(`   [FAILURE] Unexpected error: ${err.message}`);
        process.exit(1);
      }
    }

    // 8. Test Security Constraint: Grading non-enrolled student (Should fail)
    console.log("8. Testing Security Constraint: Grading non-enrolled student...");
    const otherStudentEmail = `other_${rand}@university.edu`;
    const otherStudentRes = await axios.post(
      STUDENT_URL,
      {
        name: "Bruce Banner",
        email: otherStudentEmail,
        password: "bannerpassword123",
      },
      {
        headers: { Authorization: `Bearer ${profToken}` },
      }
    );
    const otherStudentId = otherStudentRes.data._id;
    try {
      await axios.post(
        GRADE_URL,
        {
          student: otherStudentId,
          course: courseId,
          grade: "B+",
        },
        {
          headers: { Authorization: `Bearer ${profToken}` },
        }
      );
      console.error("   [FAILURE] Was able to grade a non-enrolled student!");
      process.exit(1);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        console.log("   [SUCCESS] Correctly blocked grading for non-enrolled student (409).");
      } else {
        console.error(`   [FAILURE] Unexpected error: ${err.response ? err.response.status : err.message}`);
        process.exit(1);
      }
    }

    // 9. Assign Grade to Enrolled Student (Requires Professor token)
    console.log("9. Assigning Grade to Enrolled Student...");
    const gradeRes = await axios.post(
      GRADE_URL,
      {
        student: studentId,
        course: courseId,
        grade: "A",
        remarks: "Perfect implementation of JWKS authentication mesh!",
      },
      {
        headers: { Authorization: `Bearer ${profToken}` },
      }
    );
    gradeId = gradeRes.data._id;
    console.log(`   [SUCCESS] Grade assigned successfully with ID: ${gradeId}`);

    // 10. Fetch Student's Grades (Rich Response)
    console.log("10. Fetching grades as the student...");
    const studentGradesRes = await axios.get(`${GRADE_URL}/student/${studentId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const gradesList = studentGradesRes.data;
    if (gradesList.length > 0 && gradesList[0].grade === "A" && gradesList[0].course.name) {
      console.log(`    Resolved Course Name: "${gradesList[0].course.name}"`);
      console.log(`    Grade Value: "${gradesList[0].grade}"`);
      console.log("    [SUCCESS] Student retrieved rich grades successfully.");
    } else {
      console.error("    [FAILURE] Retreived grades are incomplete or empty!");
      process.exit(1);
    }

    // 11. Test Security Constraint: Student trying to view other student's grades (Should fail)
    console.log("11. Testing Security Constraint: Student viewing other student's grades...");
    try {
      await axios.get(`${GRADE_URL}/student/${otherStudentId}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      console.error("    [FAILURE] Student was able to access other student's grades!");
      process.exit(1);
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log("    [SUCCESS] Correctly blocked cross-student grade viewing (403).");
      } else {
        console.error(`    [FAILURE] Unexpected error: ${err.message}`);
        process.exit(1);
      }
    }

    console.log("\n=== ALL ARCHITECTURE INTEGRATION TESTS PASSED SUCCESSFULLY! ===");
    process.exit(0);

  } catch (error) {
    console.error("\n[CRITICAL FAILURE] Test flow interrupted by an error:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.stack || error.message);
    }
    process.exit(1);
  }
}

runTests();
