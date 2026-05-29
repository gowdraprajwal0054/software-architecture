const express = require("express");
const Course = require("../models/course");
const router = express.Router();
const { verifyRole } = require("./auth/util");
const { ROLES } = require("../../consts");
const { courseServiceLogger: logger } = require("../../logging");

// Middleware to restrict course editing/deletion to its creator (or Admin)
async function restrictCourseToCreator(req, res, next) {
  try {
    if (req.user.roles.includes(ROLES.ADMIN)) {
      return next(); // Admins bypass creator restrictions
    }
    const course = await Course.findById(req.params.id);
    if (!course) {
      logger.warn(`Course verification failed: Course ID ${req.params.id} not found`);
      return res.status(404).json({ message: "Course not found" });
    }
    if (course.createdBy !== req.user.id) {
      logger.warn(`Access forbidden for course update/delete: User ${req.user.id} is not the creator of course ID ${req.params.id}`);
      return res.status(403).json({
        message: "Access forbidden: You are not the creator of this course",
      });
    }
    next();
  } catch (error) {
    logger.error(`Error in restrictCourseToCreator middleware: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
}

// Create a new course
router.post(
  "/",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      req.body.createdBy = req.user.id;
      logger.info(`Course creation attempt received for code: ${req.body.code} by user: ${req.user.id}`);
      const course = new Course(req.body);
      await course.save();
      logger.info(`Course created successfully with ID: ${course._id}, code: ${course.code}`);
      res.status(201).json(course);
    } catch (error) {
      logger.error(`Error creating course: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }
);

// Get all courses
router.get(
  "/",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR, ROLES.ENROLLMENT_SERVICE, ROLES.GRADE_SERVICE]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch all courses by user: ${req.user.id}, role: ${req.user.roles}`);
      const courses = await Course.find();
      logger.info(`Successfully fetched ${courses.length} courses`);
      res.status(200).json(courses);
    } catch (error) {
      logger.error(`Error fetching courses: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Get a single course by ID
router.get(
  "/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR, ROLES.ENROLLMENT_SERVICE, ROLES.GRADE_SERVICE]),
  async (req, res) => {
    try {
      logger.info(`Incoming request to fetch course ID: ${req.params.id} by user: ${req.user.id}`);
      const course = await Course.findById(req.params.id);
      if (!course) {
        logger.warn(`Course lookup failed: ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Course not found" });
      }
      logger.info(`Course successfully retrieved: ID ${req.params.id}`);
      res.status(200).json(course);
    } catch (error) {
      logger.error(`Error retrieving course ID ${req.params.id}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
);

// Update a course by ID
router.put(
  "/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  restrictCourseToCreator,
  async (req, res) => {
    try {
      logger.info(`Incoming request to update course ID: ${req.params.id} by user: ${req.user.id}`);
      // Remove the `createdBy` field from the request body
      if ("createdBy" in req.body) {
        delete req.body.createdBy;
      }
      const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!course) {
        logger.warn(`Course update failed: Course ID ${req.params.id} not found`);
        return res.status(404).json({ message: "Course not found" });
      }
      logger.info(`Course ID ${req.params.id} updated successfully`);
      res.status(200).json(course);
    } catch (error) {
      logger.error(`Error updating course ID ${req.params.id}: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }
);

// DELETE a course by ID
router.delete(
  "/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  restrictCourseToCreator,
  async (req, res) => {
    try {
      const courseId = req.params.id; // Extract the course ID from the route parameter
      logger.info(`Incoming request to delete course ID: ${courseId} by user: ${req.user.id}`);

      // Attempt to find and delete the course
      const course = await Course.findByIdAndDelete(courseId);

      if (!course) {
        logger.warn(`Course deletion failed: Course ID ${courseId} not found`);
        return res.status(404).json({ message: "Course not found" });
      }

      // Respond with success message
      logger.info(`Course ID ${courseId} deleted successfully`);
      res.status(200).json({ message: "Course deleted successfully", course });
    } catch (error) {
      logger.error(`Error deleting course ID ${req.params.id}: ${error.message}`);

      // Handle invalid ObjectId format
      if (error.kind === "ObjectId") {
        return res.status(400).json({ message: "Invalid course ID format" });
      }

      // Handle other server errors
      res
        .status(500)
        .json({ message: "Server Error: Unable to delete course" });
    }
  }
);

module.exports = router;
