// src/hooks/useCriticalPathData.ts
import { useMemo } from 'react';
import { getDurationInDays, addDays } from '../utils/dateUtils';
import { Task, TaskWithCPM } from '../types';

const useCriticalPathData = (tasks: Task[]): { criticalTasks: string[]; fullTaskData: TaskWithCPM[] } => {
    return useMemo(() => {
        if (!tasks.length) return { criticalTasks: [], fullTaskData: [] };

        const taskData = new Map<string, TaskWithCPM>();

        // 1. Inicialización y mapeo
        tasks.forEach((task, index) => {
            const duration = getDurationInDays(task.start, task.end);
            taskData.set(task.id, {
                ...task,
                duration: duration,
                ES: task.start, EF: task.end, LS: null, LF: null, Float: null, successors: [], isCritical: false, index
            } as TaskWithCPM);
        });

        // 1.b. Mapeo de Sucesores (para el Pase Adelante)
        tasks.forEach(task => {
            const dependencies = task.dependencies.split(',').map(id => id.trim()).filter(Boolean);
            dependencies.forEach(depId => {
                const predecessor = taskData.get(depId);
                if (predecessor) { predecessor.successors.push(task.id); }
            });
        });

        // 2. Pase Adelante (Forward Pass) para ES y EF
        let changedForward: boolean;
        let iterationCount = 0;
        const maxIterations = tasks.length * 2; // Límite de seguridad

        do {
            changedForward = false;
            iterationCount++;

            tasks.forEach(task => {
                const currentData = taskData.get(task.id)!; // Non-null assertion is safe here

                let newES = currentData.start;
                const dependencies = task.dependencies.split(',').map(id => id.trim()).filter(Boolean);

                if (dependencies.length > 0) {
                    let maxEF: string | null = null;
                    dependencies.forEach(depId => {
                        const predecessor = taskData.get(depId);
                        if (predecessor && predecessor.EF) {
                            // ES = EF(predecesor) + 1 día
                            const potentialES = addDays(predecessor.EF, 1);
                            if (!maxEF || potentialES > maxEF) { maxEF = potentialES; }
                        }
                    });
                    if (maxEF && maxEF > newES) { newES = maxEF; }
                }
                
                // EF = ES + Duración - 1 día
                const newEF = addDays(newES, currentData.duration - 1);

                if (newES !== currentData.ES || newEF !== currentData.EF) {
                    currentData.ES = newES;
                    currentData.EF = newEF;
                    changedForward = true;
                }
            });

            if (iterationCount > maxIterations) { break; }
        } while (changedForward);

        // 3. Obtener la Fecha de Finalización del Proyecto (Latest EF)
        let projectFinishDate = new Date(0);
        taskData.forEach(task => {
            if (task.EF) {
                const efDate = new Date(task.EF);
                if (efDate > projectFinishDate) { projectFinishDate = efDate; }
            }
        });
        const projectFinishDateStr = projectFinishDate.toISOString().split('T')[0];

        // 4. Pase Atrás (Backward Pass) para LF y LS
        // Inicializar tareas finales: LF = Fecha de finalización del proyecto
        taskData.forEach(task => {
            if (task.successors.length === 0) {
                task.LF = projectFinishDateStr;
                task.LS = addDays(task.LF, -(task.duration - 1));
            }
        });
        
        let changedBackward: boolean;
        iterationCount = 0;

        do {
            changedBackward = false;
            iterationCount++;

            for (let i = tasks.length - 1; i >= 0; i--) { // Recorrer en orden inverso
                const task = tasks[i];
                const currentData = taskData.get(task.id)!;

                if (currentData.successors.length > 0) {
                    let minLS: string | null = null;
                    currentData.successors.forEach(succId => {
                        const successor = taskData.get(succId);
                        if (successor && successor.LS) {
                            // LF = LS(sucesor) - 1 día
                            const potentialLF = addDays(successor.LS, -1);
                            if (!minLS || potentialLF < minLS) { minLS = potentialLF; }
                        }
                    });

                    if (minLS && (!currentData.LF || minLS < currentData.LF)) {
                        currentData.LF = minLS;
                        currentData.LS = addDays(currentData.LF, -(currentData.duration - 1));
                        changedBackward = true;
                    }
                }
            }

            if (iterationCount > maxIterations) { break; }
        } while (changedBackward);

        // 5. Calcular Holgura (Float) e identificar la Ruta Crítica
        const criticalTasks: string[] = [];
        const finalTaskData: TaskWithCPM[] = [];

        taskData.forEach(task => {
            let Float = 0;
            if (task.LF && task.EF) {
                const lfDate = new Date(task.LF);
                const efDate = new Date(task.EF);
                // Diferencia en días
                Float = Math.round((lfDate.getTime() - efDate.getTime()) / (1000 * 60 * 60 * 24));
            }
            task.Float = Float;
            task.isCritical = task.Float === 0;

            if (task.isCritical) { criticalTasks.push(task.id); }
            finalTaskData.push(task);
        });

        return { criticalTasks, fullTaskData: finalTaskData };

    }, [tasks]);
};

export default useCriticalPathData;