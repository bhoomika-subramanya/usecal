import { Router, type IRouter } from "express";
import healthRouter from "./health";
import annotationsRouter from "./annotations";
import tagsRouter from "./tags";
import uploadRouter from "./upload";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(annotationsRouter);
router.use(tagsRouter);
router.use(uploadRouter);
router.use("/ai", aiRouter);

export default router;
