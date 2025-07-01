import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { InvokeResponse } from "@/models/response";
import {
  PTaskEventPayload,
  TaskDesc,
  TaskParam,
  TaskProgressListener,
  TaskResult,
} from "@/models/task";
import { responseHandler } from "@/utils/response";

/**
 * TaskService class for managing tasks.
 */
export class TaskService {
  /**
   * Schedule a group of progressive tasks.
   * @param taskGroup - The name of the task group.
   * @param params - The parameters for the tasks to be scheduled.
   * @returns {Promise<InvokeResponse<TaskResult>>}
   */
  @responseHandler("task")
  static async scheduleProgressiveTaskGroup(
    taskGroup: string,
    params: TaskParam[]
  ): Promise<InvokeResponse<TaskResult>> {
    return await invoke("schedule_progressive_task_group", {
      taskGroup,
      params,
    });
  }

  /**
   * Cancel a task.
   * @param taskId - The ID of the progressive task to be cancelled.
   * @returns {Promise<InvokeResponse<null>>}
   */
  @responseHandler("task")
  static async cancelProgressiveTask(
    taskId: number
  ): Promise<InvokeResponse<null>> {
    return await invoke("cancel_progressive_task", { taskId });
  }

  /**
   * Resume a task.
   * @param taskId - The ID of the progressive task to be resumed.
   * @returns {Promise<InvokeResponse<null>>}
   */
  @responseHandler("task")
  static async resumeProgressiveTask(
    taskId: number
  ): Promise<InvokeResponse<null>> {
    return await invoke("resume_progressive_task", { taskId });
  }

  /**
   * Stop a task.
   * @param taskId - The ID of the progressive task to be stopped.
   * @returns {Promise<InvokeResponse<null>>}
   */
  @responseHandler("task")
  static async stopProgressiveTask(
    taskId: number
  ): Promise<InvokeResponse<null>> {
    return await invoke("stop_progressive_task", { taskId });
  }

  /**
   * Retrieve the list of progressive tasks.
   * @returns {Promise<InvokeResponse<TaskDesc[]>>}
   */
  @responseHandler("task")
  static async retrieveProgressiveTaskList(): Promise<
    InvokeResponse<TaskDesc[]>
  > {
    return await invoke("retrieve_progressive_task_list");
  }

  static onProgressiveTaskUpdate(
    callback: (payload: PTaskEventPayload) => void
  ) {
    const unlisten = listen<PTaskEventPayload>(
      "update",
      (event) => {
        callback(event.payload);
      },
      {
        target: TaskProgressListener,
      }
    );

    return () => {
      unlisten.then((f) => f());
    };
  }
}
