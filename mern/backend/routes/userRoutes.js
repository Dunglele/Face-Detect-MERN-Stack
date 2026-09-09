import express from 'express';
import {
  getUsers,
  createUser,
  updateFaceEnrollment,
  deleteUser,
} from '../controllers/userController.js';

const router = express.Router();

router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .delete(deleteUser);

router.route('/:id/face')
  .patch(updateFaceEnrollment);

export default router;
