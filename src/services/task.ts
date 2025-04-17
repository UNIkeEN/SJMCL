import { invoke } from "@tauri-apps/api/core";
import { InvokeResponse } from "@/models/response";
import { TaskParam, TaskResult, TaskState } from "@/models/task";
import { responseHandler } from "@/utils/response";

/**
 * TaskService class for managing tasks.
 */
export class TaskService {
  /**
   * Schedule a group of tasks.
   * @param taskGroup - The name of the task group.
   * @param params - The parameters for the tasks to be scheduled.
   * @returns {Promise<InvokeResponse<TaskResult>>}
   */
  @responseHandler("task")
  static async scheduleTaskGroup(
    taskGroup: string,
    params: TaskParam[]
  ): Promise<InvokeResponse<TaskResult>> {
    return await invoke("schedule_task_group", {
      taskGroup,
      params,
    });
  }

  /**
   * Cancel a task.
   * @param taskId - The ID of the task to be cancelled.
   * @returns {Promise<InvokeResponse<null>>}
   */
  @responseHandler("task")
  static async cancelTask(taskId: number): Promise<InvokeResponse<null>> {
    return await invoke("cancel_task", { taskId });
  }

  /**
   * Resume a task.
   * @param taskId - The ID of the task to be resumed.
   * @returns {Promise<InvokeResponse<null>>}
   */
  @responseHandler("task")
  static async resumeTask(taskId: number): Promise<InvokeResponse<null>> {
    return await invoke("resume_task", { taskId });
  }

  /**
   * Stop a task.
   * @param taskId - The ID of the task to be stopped.
   * @returns {Promise<InvokeResponse<null>>}
   */
  @responseHandler("task")
  static async stopTask(taskId: number): Promise<InvokeResponse<null>> {
    return await invoke("stop_task", { taskId });
  }

  /**
   * Retrieve the list of tasks.
   * @returns {Promise<InvokeResponse<TaskState[]>>}
   */
  @responseHandler("task")
  static async retrieveTaskList(): Promise<InvokeResponse<TaskState[]>> {
    return await invoke("retrieve_task_list");
  }
}
