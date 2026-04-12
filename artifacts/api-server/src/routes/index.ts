import { Router, type IRouter } from "express";
import healthRouter from "./health";
import annotationsRouter from "./annotations";
import tagsRouter from "./tags";

const router: IRouter = Router();

router.use(healthRouter);
router.use(annotationsRouter);
router.use(tagsRouter);

export default router;
