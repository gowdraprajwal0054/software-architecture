const express = require("express");
const Professor = require("../models/professor");
const bcrypt = require("bcrypt");
const { verifyRole, restrictProfessorToOwnData } = require("./auth/util");
const { ROLES } = require("../../consts");
const router = express.Router();

module.exports = router;
