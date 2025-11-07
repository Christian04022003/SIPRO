// src/utils/rollupUtils.ts
import { minDate, maxDate } from './dateUtils';
import { Task } from '../types';

/**
 * Propaga recursivamente las fechas de las subtareas a las tareas padre.
 */
export const rollupParentDates = (parentId: string, currentTasks: Task[]): Task[] => {
    if (!parentId) return currentTasks;

    const children = currentTasks.filter(t => t.parentId === parentId);
    if (children.length === 0) return currentTasks;

    let minStart: string | null = null;
    let maxEnd: string | null = null;

    children.forEach(child => {
        if (child.start && child.end) {
             minStart = minDate(minStart, child.start);
             maxEnd = maxDate(maxEnd, child.end);
        }
    });

    return currentTasks.map(task => {
        if (task.id === parentId) {
            let updatedTask = { ...task };
            let changed = false;

            if (minStart && task.start !== minStart) {
                updatedTask.start = minStart;
                changed = true;
            }
            if (maxEnd && task.end !== maxEnd) {
                updatedTask.end = maxEnd;
                changed = true;
            }

            if (changed) {
                // Si la tarea padre cambió, recursivamente actualiza a su propio padre
                if (updatedTask.parentId) {
                    const tasksAfterLocalUpdate = currentTasks.map(t => (t.id === parentId ? updatedTask : t));
                    
                    // Asegura devolver la versión más reciente tras la recursión
                    return rollupParentDates(updatedTask.parentId, tasksAfterLocalUpdate).find(t => t.id === parentId) || updatedTask;
                }
            }
            return updatedTask;
        }
        return task;
    });
};