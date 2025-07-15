import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { InvokeResponse } from "@/models/response";
import { PTaskEventPayload, TaskGroupDesc, TaskParam } from "@/models/task";
import { responseHandler } from "@/utils/response";

/**
 * TaskService class for managing tasks.
 */
export class TaskService {
  /**
   * Schedule a group of progressive tasks.
   * @param taskGroup - The name of the task group.
   * @param params - The parameters for the tasks to be scheduled.
   * @param withTimestamp - Whether to append a timestamp to the task group name for uniqueness.
   *                      Defaults to true.
   * @returns {Promise<InvokeResponse<TaskGroupDesc>>}
   */
  @responseHandler("task")
  static async scheduleProgressiveTaskGroup(
    taskGroup: string,
    params: TaskParam[],
    withTimestamp: boolean = true
  ): Promise<InvokeResponse<TaskGroupDesc>> {
    return await invoke("schedule_progressive_task_group", {
      taskGroup,
      params,
      withTimestamp,
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
   * Stop a task group.
   * @ param taskGroup - The name of the task group to be stopped.
   * @ returns {Promise<InvokeResponse<null>>}
   *
   */
  @responseHandler("task")
  static async stopProgressiveTaskGroup(
    taskGroup: string
  ): Promise<InvokeResponse<null>> {
    return await invoke("stop_progressive_task_group", { taskGroup });
  }

  /**
   * Cancel a task group.
   * @param taskGroup - The name of the task group to be cancelled.
   * @returns {Promise<InvokeResponse<null>>}
   *
   */
  @responseHandler("task")
  static async cancelProgressiveTaskGroup(
    taskGroup: string
  ): Promise<InvokeResponse<null>> {
    return await invoke("cancel_progressive_task_group", { taskGroup });
  }

  /**
   * Resume a task group.
   * @param taskGroup - The name of the task group to be resumed.
   * @returns {Promise<InvokeResponse<null>>}
   */
  @responseHandler("task")
  static async resumeProgressiveTaskGroup(
    taskGroup: string
  ): Promise<InvokeResponse<null>> {
    return await invoke("resume_progressive_task_group", { taskGroup });
  }

  /**
   * Retrieve the list of progressive tasks.
   * @returns {Promise<InvokeResponse<TaskGroupDesc[]>>}
   */
  @responseHandler("task")
  static async retrieveProgressiveTaskList(): Promise<
    InvokeResponse<TaskGroupDesc[]>
  > {
    return await invoke("retrieve_progressive_task_list");
  }

  /**
   * Listen for updates to progressive tasks.
   * @param callback - The callback to be invoked when a task update occurs.
   */
  static onProgressiveTaskUpdate(
    callback: (payload: PTaskEventPayload) => void
  ): () => void {
    const unlisten = getCurrentWebview().listen<PTaskEventPayload>(
      "task:progress-update",
      (event) => {
        callback(event.payload);
      }
    );

    return () => {
      unlisten.then((f) => f());
    };
  }
}
