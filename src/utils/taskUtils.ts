// src/utils/taskUtils.ts
import { TaskWithCPM } from '../types';

export const generateUniqueId = (prefix = 'T'): string => `${prefix}${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`;

// Calcula la profundidad de indentación
export const getTaskDepth = (task: TaskWithCPM, allTasks: TaskWithCPM[], depth: number = 0): number => {
    if (!task.parentId) return depth;
    const parent = allTasks.find(t => t.id === task.parentId);
    return parent ? getTaskDepth(parent, allTasks, depth + 1) : depth;
};

// Determina si una tarea está oculta
export const isTaskHidden = (task: TaskWithCPM, collapsedParents: Record<string, boolean>, allTasks: TaskWithCPM[]): boolean => {
    let currentTask: TaskWithCPM | undefined = task;
    while (currentTask?.parentId) {
        if (collapsedParents[currentTask.parentId]) {
            return true;
        }
        currentTask = allTasks.find(t => t.id === currentTask!.parentId);
    }
    return false;
};