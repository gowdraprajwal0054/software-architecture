const express = require("express");
const Grade = require("../models/grade");
const {
  verifyRole,
  restrictStudentToOwnData,
  fetchStudent,
  fetchCourse,
  fetchEnrollmentsForStudent,
} = require("./auth/util");
const { ROLES } = require("../../consts");
const { gradeServiceLogger: logger } = require("../../logging");
const { getCorrelationId } = require("../../correlationId");

const router = express.Router();

// Create a new Grade
router.post(
  "/",
  verifyRole([ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      const { student, course, grade, remarks } = req.body;

      if (!student || !course || !grade) {
        return res
          .status(400)
          .json({ message: "Student ID, Course ID, and Grade value are required" });
      }

      // 1. Fetch and validate course existence
      let courseDetails;
      try {
        courseDetails = await fetchCourse(course);
      } catch (err) {
        logger.error(`Course verification failed for ID ${course}: ${err.message}`);
        return res.status(404).json({ message: `Course not found` });
      }

      // 2. Validate that only the creator of the course can grade it
      if (courseDetails.createdBy !== req.user.id) {
        return res.status(403).json({
          message: "Access forbidden: Only the professor who created the course can grade students",
        });
      }

      // 3. Fetch and validate student existence
      try {
        await fetchStudent(student);
      } catch (err) {
        logger.error(`Student verification failed for ID ${student}: ${err.message}`);
        return res.status(404).json({ message: "Student not found" });
      }

      // 4. Validate that the student is actually enrolled in this course
      let enrollments = [];
      try {
        enrollments = await fetchEnrollmentsForStudent(student);
      } catch (err) {
        logger.error(`Enrollments fetch failed for student ID ${student}: ${err.message}`);
      }

      const isEnrolled = enrollments.some(
        (e) =>
          (e.course && e.course._id === course) ||
          e.course === course
      );

      if (!isEnrolled) {
        return res.status(409).json({
          message: "Conflict: Student is not enrolled in this course",
        });
      }

      // 5. Save the grade
      const newGrade = new Grade({
        student,
        course,
        professor: req.user.id,
        grade,
        remarks,
      });

      await newGrade.save();
      logger.info(`Grade created successfully for student ${student} in course ${course}`);
      res.status(201).json(newGrade);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "Duplicate entry: A grade already exists for this student in this course.",
        });
      }
      res.status(500).json({
        message: "Server Error: Unable to assign grade",
        error: error.message,
        correlationId: getCorrelationId(),
      });
    }
  }
);

// Get all grades (for Admin and Professors)
router.get(
  "/",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch all grades. User: ${req.user.id}, Roles: ${req.user.roles}`);
      let filter = {};
      if (req.user.roles.includes(ROLES.PROFESSOR)) {
        filter.professor = req.user.id; // Professors can only view grades they assigned
      }

      const grades = await Grade.find(filter);
      logger.info(`Successfully fetched ${grades.length} matching grades`);
      res.status(200).json(grades);
    } catch (error) {
      logger.error(`Error fetching grades: ${error.message}`);
      res.status(500).json({
        message: "Server Error: Unable to fetch grades",
        error: error.message,
      });
    }
  }
);

// Get rich grades for a specific student (with course name resolution)
router.get(
  "/student/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR, ROLES.STUDENT]),
  restrictStudentToOwnData,
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch rich grades for student ID: ${req.params.id}. User: ${req.user.id}`);
      const grades = await Grade.find({ student: req.params.id });

      if (!grades.length) {
        logger.info(`No grades found for student ID: ${req.params.id}`);
        return res.status(200).json([]);
      }

      // Resolve course details asynchronously to provide rich response
      const uniqueCourseIds = [...new Set(grades.map((g) => g.course))];
      const coursesMap = {};

      await Promise.all(
        uniqueCourseIds.map(async (cId) => {
          try {
            coursesMap[cId] = await fetchCourse(cId);
          } catch (err) {
            coursesMap[cId] = { name: "Unknown Course", code: cId };
          }
        })
      );

      const richGrades = grades.map((grade) => {
        const gradeObj = grade.toObject();
        gradeObj.course = coursesMap[grade.course] || {
          name: "Unknown Course",
          code: grade.course,
        };
        return gradeObj;
      });

      logger.info(`Successfully fetched resolved rich grades for student ${req.params.id}`);
      res.status(200).json(richGrades);
    } catch (error) {
      logger.error(`Error fetching student grades for ID ${req.params.id}: ${error.message}`);
      res.status(500).json({
        message: "Server Error: Unable to fetch student grades",
        error: error.message,
      });
    }
  }
);

// Update a grade
router.put(
  "/:id",
  verifyRole([ROLES.PROFESSOR, ROLES.ADMIN]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to update grade ID: ${req.params.id} by user: ${req.user.id}`);
      const grade = await Grade.findById(req.params.id);
      if (!grade) {
        logger.warn(`Grade update failed: Grade ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Grade not found" });
      }

      // Restrict professors from updating other professors' grades
      if (
        req.user.roles.includes(ROLES.PROFESSOR) &&
        grade.professor !== req.user.id
      ) {
        logger.warn(`Access forbidden: Professor ${req.user.id} tried to update grade ID ${req.params.id} created by different professor`);
        return res.status(403).json({
          message: "Access forbidden: You cannot update grades assigned by other professors",
        });
      }

      const { grade: gradeValue, remarks } = req.body;
      if (gradeValue) grade.grade = gradeValue;
      if (remarks !== undefined) grade.remarks = remarks;

      await grade.save();
      logger.info(`Grade ID ${req.params.id} updated successfully`);
      res.status(200).json(grade);
    } catch (error) {
      logger.error(`Error updating grade ID ${req.params.id}: ${error.message}`);
      res.status(500).json({
        message: "Server Error: Unable to update grade",
        error: error.message,
      });
    }
  }
);

// Delete a grade
router.delete(
  "/:id",
  verifyRole([ROLES.PROFESSOR, ROLES.ADMIN]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to delete grade ID: ${req.params.id} by user: ${req.user.id}`);
      const grade = await Grade.findById(req.params.id);
      if (!grade) {
        logger.warn(`Grade deletion failed: Grade ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Grade not found" });
      }

      // Restrict professors from deleting other professors' grades
      if (
        req.user.roles.includes(ROLES.PROFESSOR) &&
        grade.professor !== req.user.id
      ) {
        logger.warn(`Access forbidden: Professor ${req.user.id} tried to delete grade ID ${req.params.id} created by different professor`);
        return res.status(403).json({
          message: "Access forbidden: You cannot delete grades assigned by other professors",
        });
      }

      await Grade.findByIdAndDelete(req.params.id);
      logger.info(`Grade ID ${req.params.id} deleted successfully`);
      res.status(200).json({ message: "Grade deleted successfully", grade });
    } catch (error) {
      logger.error(`Error deleting grade ID ${req.params.id}: ${error.message}`);
      res.status(500).json({
        message: "Server Error: Unable to delete grade",
        error: error.message,
      });
    }
  }
);

module.exports = router;
