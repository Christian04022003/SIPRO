import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

// === Definiciones de tipos y constantes asumidas ===
/** @typedef {'Day' | 'Week' | 'Month'} ViewModeType */
/** @typedef {'Alta' | 'Media' | 'Baja'} PriorityType */
/** @typedef {{ id: string, name: string, start: string, end: string, progress: number, parentId: string | null, cost: number, priority: PriorityType, dependencies: string, isMilestone: boolean, index?: string, [key: string]: any }} Task */
/** @typedef {Task & { duration: number, earlyStart: string, earlyFinish: string, lateStart: string, lateFinish: string, totalSlack: number, isCritical: boolean }} TaskWithCPM */
/** @typedef {{ id: string, header: string, defaultSize: number, accessorKey: string, type?: 'date' | 'cost' | 'text' | 'priority' | 'number' }} ColumnDef */


// === IMPORTACIONES (Asegúrate de que estas rutas sean correctas) ===
// NOTA: 'initialTasks' y 'ViewMode' deben estar definidas en './constants'
// NOTA: 'EditableCell' y 'CustomGantt' deben estar definidas en './components'
import { initialTasks, ViewMode, defaultColumnsDef, availableColumnTypes } from './constants'; 
import EditableCell from './components/EditableCell';
import CustomGantt from './components/CustomGantt';


// === CONSTANTES DE LAYOUT ===
const ROW_HEIGHT_PX = 30;
const MIN_COLLAPSED_WIDTH = 5; 
const DEFAULT_RESTORE_WIDTH = 150; 

const getParentChain = (taskId, allTasks, chain = new Set()) => {
    const task = allTasks.find(t => t.id === taskId);
    if (task && task.parentId) {
        chain.add(task.parentId);
        getParentChain(task.parentId, allTasks, chain);
    }
    return chain;
};

const generateUniqueId = (tasks) => {
    let id;
    let num = tasks.length + 1;
    do {
        id = `T${num}`;
        num++;
    } while (tasks.some(t => t.id === id));
    return id;
};

const addDays = (dateStr, days) => {
    // Si la duración es N, el fin es N-1 días después del inicio.
    // Ejemplo: Inicio día 1, Duración 5 días. Fin = 1 + (5 - 1) = día 5.
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    // Si days es la duración, sumamos days - 1 día
    date.setDate(date.getDate() + days - 1); 
    return date.toISOString().split('T')[0];
};

const getDuration = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

const findLastDescendantIndex = (parentId, tasks) => {
    const parentIndex = tasks.findIndex(t => t.id === parentId);
    if (parentIndex === -1) return -1;
    let lastIndex = parentIndex;

    for (let i = parentIndex + 1; i < tasks.length; i++) {
        let currentParentId = tasks[i].parentId;
        let isDescendant = false;

        while (currentParentId) {
            if (currentParentId === parentId) {
                isDescendant = true;
                break;
            }
            const parentTask = tasks.find(t => t.id === currentParentId);
            currentParentId = parentTask ? parentTask.parentId : null;
        }

        if (isDescendant) {
            lastIndex = i;
        } else {
            break;
        }
    }
    return lastIndex;
};

const calculateTaskIndices = (tasks) => {
    const indexTracker = {};
    const indexedTasks = [];

    for (const task of tasks) {
        const parentIdKey = task.parentId || 'root';

        let parentIndexPrefix = '';
        if (task.parentId) {
            const parent = indexedTasks.find(t => t.id === task.parentId);
            if (parent && parent.index) {
                parentIndexPrefix = parent.index + '.';
            }
        }

        indexTracker[parentIdKey] = (indexTracker[parentIdKey] || 0) + 1;
        const taskIndex = parentIndexPrefix + indexTracker[parentIdKey];
        indexedTasks.push({ ...task, index: taskIndex });
    }
    return indexedTasks;
};


const isTaskHidden = (task, collapsedParents, allTasks) => {
    if (!task.parentId) return false;

    let currentParentId = task.parentId;
    while (currentParentId) {
        if (collapsedParents[currentParentId]) return true;

        const parentTask = allTasks.find(t => t.id === currentParentId);
        currentParentId = parentTask ? parentTask.parentId : null;
    }
    return false;
};

const rollupParentDates = (parentId, tasks) => {
    const children = tasks.filter(t => t.parentId === parentId);

    if (children.length === 0) {
        const parent = tasks.find(t => t.id === parentId);
        return { start: parent?.start, end: parent?.end };
    }

    const startTimestamps = children
        .map(t => new Date(t.start).getTime())
        .filter(t => !isNaN(t));

    const endTimestamps = children
        .map(t => new Date(t.end).getTime())
        .filter(t => !isNaN(t));

    if (startTimestamps.length === 0 || endTimestamps.length === 0) {
        const parent = tasks.find(t => t.id === parentId);
        return { start: parent?.start, end: parent?.end };
    }

    const earliestStart = new Date(Math.min(...startTimestamps));
    const latestEnd = new Date(Math.max(...endTimestamps));

    return {
        start: earliestStart.toISOString().split('T')[0],
        end: latestEnd.toISOString().split('T')[0],
    };
};

// --- Utilities para CPM ---
const getPredecessors = (taskId, tasks) => {
    return tasks.filter(t => t.dependencies && t.dependencies.split(',').map(id => id.trim()).includes(taskId));
};

const dateToDays = (dateStr) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 0;
    const baseDate = new Date('2000-01-01');
    return Math.floor((date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
};

const daysToDate = (days) => {
    const baseDate = new Date('2000-01-01');
    const newDate = new Date(baseDate.getTime() + (days * 1000 * 60 * 60 * 24));
    return newDate.toISOString().split('T')[0];
};

const calculateCriticalPath = (tasks) => {
    if (!tasks || tasks.length === 0) return [];

    let cpmTasks = tasks.map(t => ({
        ...t,
        duration: getDuration(t.start, t.end),
        earlyStart: t.start,
        earlyFinish: t.end,
        lateStart: '', lateFinish: '',
        totalSlack: 0, isCritical: false
    }));

    const taskMap = new Map(cpmTasks.map(t => [t.id, t]));

    // PASO ADELANTE (FORWARD PASS)
    for (const task of cpmTasks) {
        let maxPredecessorFinishDay = -Infinity;
        const dependencies = task.dependencies ? task.dependencies.split(',').map(id => id.trim()) : [];

        if (dependencies.length > 0) {
            for (const depId of dependencies) {
                const predecessor = taskMap.get(depId);
                if (predecessor && predecessor.earlyFinish) {
                    const predecessorEFDay = dateToDays(predecessor.earlyFinish);
                    maxPredecessorFinishDay = Math.max(
                        maxPredecessorFinishDay,
                        predecessorEFDay
                    );
                }
            }
        }

        const earlyStartDay = isFinite(maxPredecessorFinishDay)
            ? maxPredecessorFinishDay + 1
            : dateToDays(task.start);

        const earlyFinishDay = earlyStartDay + task.duration - 1;

        task.earlyStart = daysToDate(earlyStartDay);
        task.earlyFinish = daysToDate(earlyFinishDay);
    }

    // PASO ATRÁS (BACKWARD PASS)
    const projectFinishDay = cpmTasks.reduce((max, t) => {
        const finishDay = dateToDays(t.earlyFinish);
        return finishDay > max ? finishDay : max;
    }, -Infinity);

    for (let i = cpmTasks.length - 1; i >= 0; i--) {
        const task = cpmTasks[i];
        const successors = getPredecessors(task.id, cpmTasks);
        let minSuccessorStartDay = Infinity;

        if (successors.length > 0) {
            for (const successor of successors) {
                const successorLS = taskMap.get(successor.id);
                const successorLSDay = dateToDays(successorLS.lateStart);

                minSuccessorStartDay = Math.min(
                    minSuccessorStartDay,
                    successorLSDay
                );
            }
        }

        const lateFinishDay = isFinite(minSuccessorStartDay)
            ? minSuccessorStartDay - 1
            : projectFinishDay;

        const lateStartDay = lateFinishDay - task.duration + 1;

        task.lateFinish = daysToDate(lateFinishDay);
        task.lateStart = daysToDate(lateStartDay);

        task.totalSlack = lateStartDay - dateToDays(task.earlyStart);
        task.isCritical = task.totalSlack <= 0;
    }

    return cpmTasks;
};

/**
 * Función para clasificar el array de tareas
 */
const compareValues = (a, b, type) => {
    // Manejo de valores nulos o indefinidos
    if (a == null) return b == null ? 0 : -1;
    if (b == null) return a == null ? 0 : 1;

    switch (type) {
        case 'date':
            const dateA = new Date(a).getTime();
            const dateB = new Date(b).getTime();
            if (isNaN(dateA)) return isNaN(dateB) ? 0 : -1;
            if (isNaN(dateB)) return isNaN(dateA) ? 0 : 1;
            return dateA - dateB;

        case 'number':
        case 'cost':
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (isNaN(numA)) return isNaN(numB) ? 0 : -1;
            if (isNaN(numB)) return isNaN(numA) ? 0 : 1;
            return numA - numB;

        case 'priority':
            const priorityOrder = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
            const pA = priorityOrder[a] || 0;
            const pB = priorityOrder[b] || 0;
            return pA - pB;

        case 'text':
        default:
            return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    }
};

const sortTasks = (tasks, accessorKey, direction, allColumns) => {
    if (!accessorKey) return tasks;

    const column = allColumns.find(c => c.accessorKey === accessorKey);
    if (!column) return tasks;

    const compare = (a, b) => {
        const valA = a[accessorKey];
        const valB = b[accessorKey];
        let result = compareValues(valA, valB, column.type);
        // Aplicar la dirección
        return direction === 'asc' ? result : -result;
    };

    return [...tasks].map((t, index) => ({ ...t, originalIndex: index }))
        .sort((a, b) => {
            const comparisonResult = compare(a, b);
            return comparisonResult === 0 ? a.originalIndex - b.originalIndex : comparisonResult;
        })
        .map(({ originalIndex, ...t }) => t);
};


// =================================================================
// --- COMPONENTE PRINCIPAL (TableGantt) ---
// =================================================================
const TableGantt = () => {
    // --------------------------------------------------------------------------------------
    // 1. ESTADO Y REFS
    // --------------------------------------------------------------------------------------
    const [leftPanelWidth, setLeftPanelWidth] = useState(55);
    const [tasks, setTasks] = useState(initialTasks);
    const [viewMode, setViewMode] = useState(ViewMode.Month);
    const [collapsedParents, setCollapsedParents] = useState({});

    // ESTADO DE ORDENACIÓN ÚNICO
    const [sorting, setSorting] = useState({ accessorKey: null, direction: 'asc' });

    // Estado para filtros por columna (no implementado en JSX, pero sí en la lógica)
    const [columnFilters, setColumnFilters] = useState({});

    // ESTADO PARA EL BUSCADOR Y PADRES
    const [taskSearchTerm, setTaskSearchTerm] = useState('');
    const [showParentChain, setShowParentChain] = useState(false); 

    // Columnas
    const [dynamicColumns, setDynamicColumns] = useState([]);
    const [columnWidths, setColumnWidths] = useState(
        defaultColumnsDef.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultSize }), {})
    );
    const [savedColumnWidths, setSavedColumnWidths] = useState({});

    // Ref para el redimensionamiento de columna
    const columnResizingInfo = useRef({
        isResizing: false,
        currentColumnId: null,
        startX: 0,
        startWidth: 0,
    });
    const [isColumnResizingActive, setIsColumnResizingActive] = useState(false);

    // Ref para el redimensionamiento del divisor central
    const [isPanelResizing, setIsPanelResizing] = useState(false);

    const containerRef = useRef(null);
    const tableScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);

    const [isAddingColumn, setIsAddingColumn] = useState(false);
    const [newColumnName, setNewColumnName] = useState('Campo Personalizado');
    const [newColumnType, setNewColumnType] = useState('text');


    // --------------------------------------------------------------------------------------
    // 2. CÁLCULO DE DATOS Y COLUMNAS
    // --------------------------------------------------------------------------------------
    const tasksWithIndices = useMemo(() => calculateTaskIndices(tasks), [tasks]);
    const fullTaskData = useMemo(() => calculateCriticalPath(tasksWithIndices), [tasksWithIndices]);
    const columns = useMemo(() => [...defaultColumnsDef, ...dynamicColumns], [dynamicColumns]);

    // Función de filtrado y ordenamiento central
    const getSortedAndFilteredTasks = useCallback((data, currentSortConfig, searchTerm, showParents, columnDefs) => {
        let filteredTasks = data;

        // 1. FILTRO GLOBAL POR NOMBRE DE TAREA
        if (searchTerm.trim()) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            let matchedTasks = filteredTasks.filter(task =>
                String(task.name).toLowerCase().includes(lowerCaseSearchTerm)
            );

            // 2. INCLUIR CADENA DE PADRES SI showParents ES TRUE
            if (showParents) {
                const parentIdsToShow = new Set();
                for (const task of matchedTasks) {
                    getParentChain(task.id, data, parentIdsToShow);
                }

                const allVisibleIds = new Set(matchedTasks.map(t => t.id));
                parentIdsToShow.forEach(id => allVisibleIds.add(id));

                filteredTasks = data.filter(task => allVisibleIds.has(task.id));
            } else {
                filteredTasks = matchedTasks;
            }
        }

        // 3. APLICAR ORDENAMIENTO
        const sortKey = currentSortConfig.accessorKey;
        const sortDirection = currentSortConfig.direction;

        if (!sortKey || sortDirection === null) return filteredTasks;

        return sortTasks(filteredTasks, sortKey, sortDirection, columnDefs);

    }, []);

    const sortedAndFilteredTasks = useMemo(() => {
        return getSortedAndFilteredTasks(fullTaskData, sorting, taskSearchTerm, showParentChain, columns); 
    }, [fullTaskData, sorting, taskSearchTerm, showParentChain, columns, getSortedAndFilteredTasks]);


    const totalTableWidth = useMemo(() => columns.reduce((sum, col) => sum + (columnWidths[col.id] || col.defaultSize), 0), [columns, columnWidths]);

    const parentIds = useMemo(() => {
        const parents = sortedAndFilteredTasks.map(t => t.parentId).filter(Boolean);
        return new Set(parents);
    }, [sortedAndFilteredTasks]);

    const visibleTasks = useMemo(() => {
        if (sortedAndFilteredTasks.length === 0) return [];
        return sortedAndFilteredTasks.filter((task) => !isTaskHidden(task, collapsedParents, sortedAndFilteredTasks));
    }, [sortedAndFilteredTasks, collapsedParents]);


    // --- HANDLERS DE ORDENACIÓN (Único y Correcto) ---
    const handleSort = useCallback((accessorKey) => {
        
        // Excluir columnas sin accessorKey (si las hubiera) o la columna de índice
        if (!accessorKey || accessorKey === 'index') return;

        setSorting(prev => {
            if (prev.accessorKey !== accessorKey) {
                return { accessorKey, direction: 'asc' };
            }
            if (prev.direction === 'asc') {
                return { accessorKey, direction: 'desc' };
            }
            // Tercer clic resetea la ordenación
            return { accessorKey: null, direction: 'asc' };
        });

    }, []);
    
    // Función auxiliar para mostrar el indicador de ordenación (⬆️ o ⬇️)
    const getSortIndicator = useCallback((accessorKey) => {
        // if (sorting.accessorKey !== accessorKey) return null;
        return sorting.direction === 'asc' ? ' ⬆️' : ' ⬇️';
    }, [sorting]);


    // --------------------------------------------------------------------------------------
    // 3. HANDLERS DE TAREAS Y ROLLUPS
    // --------------------------------------------------------------------------------------
    const rollupDates = useCallback((parentId, currentTasks) => rollupParentDates(parentId, currentTasks), []);

    const calculateAggregatedProgress = useCallback((parentId, currentTasks) => {
        const children = currentTasks.filter(t => t.parentId === parentId);
        if (children.length === 0) return currentTasks.find(t => t.id === parentId)?.progress ?? 0;
        let totalWeightedProgress = 0;
        let totalDuration = 0;
        for (const child of children) {
            const duration = getDuration(child.start, child.end);
            // Recursividad para sub-tareas
            const childProgress = currentTasks.some(t => t.parentId === child.id) ? calculateAggregatedProgress(child.id, currentTasks) : child.progress;

            totalWeightedProgress += (childProgress * duration);
            totalDuration += duration;
        }
        return totalDuration === 0 ? 0 : Math.round(totalWeightedProgress / totalDuration);
    }, []);

    const createNewTask = useCallback((currentTasks, parentId, isMilestone) => {
        const id = generateUniqueId(currentTasks);
        const parentTask = parentId ? currentTasks.find(t => t.id === parentId) : null;
        const today = new Date().toISOString().split('T')[0];
        const startDate = parentTask ? parentTask.start : today;
        const endDate = isMilestone ? startDate : addDays(startDate, 4);

        return {
            id: id,
            name: isMilestone ? `Hito ${id}` : `Tarea ${id}`,
            start: startDate,
            end: endDate,
            progress: isMilestone ? 100 : 0,
            parentId: parentId,
            cost: 100,
            priority: isMilestone ? 'Alta' : 'Media',
            dependencies: parentId || '',
            isMilestone: isMilestone,
            // Inicializar campos dinámicos
            ...dynamicColumns.reduce((acc, col) => ({ ...acc, [col.accessorKey]: '' }), {})
        };
    }, [dynamicColumns]);

    const addNewTask = useCallback((parentId = null) => {
        setTasks(prevTasks => {
            const newTask = createNewTask(prevTasks, parentId, false);
            let newTasks = [...prevTasks];

            if (parentId) {
                const lastDescendantIndex = findLastDescendantIndex(parentId, newTasks);
                if (lastDescendantIndex !== -1) newTasks.splice(lastDescendantIndex + 1, 0, newTask);
                else newTasks.push(newTask);
                // Rollup de fechas
                newTasks = newTasks.map(t => t.id === parentId ? { ...t, ...rollupDates(parentId, newTasks) } : t);
            } else { newTasks.push(newTask); }
            return newTasks;
        });
    }, [createNewTask, rollupDates]);

    const addNewMilestone = useCallback((parentId) => {
        setTasks(prevTasks => {
            const newMilestone = createNewTask(prevTasks, parentId, true);
            let newTasks = [...prevTasks];

            if (parentId) {
                const lastDescendantIndex = findLastDescendantIndex(parentId, newTasks);
                if (lastDescendantIndex !== -1) newTasks.splice(lastDescendantIndex + 1, 0, newMilestone);
                else newTasks.push(newMilestone);
                // Rollup de fechas
                newTasks = newTasks.map(t => t.id === parentId ? { ...t, ...rollupDates(parentId, newTasks) } : t);
            } else { newTasks.push(newMilestone); }

            return newTasks;
        });
    }, [createNewTask, rollupDates]);

    // Asegúrate de que esta función esté dentro del componente TableGantt
const updateTaskData = useCallback((id, columnId, newValue) => {
    setTasks(prevTasks => {
        let updatedTasks = prevTasks.map(task => {
            if (task.id === id) {
                let finalValue = newValue;
                if (columnId === 'cost' || columnId === 'progress' || columnId === 'duration' || typeof task[columnId] === 'number') {
                    finalValue = Math.max(0, parseFloat(newValue) || 0); // Asegura duración/progreso/costo >= 0
                }
                if (columnId === 'progress') finalValue = Math.min(100, finalValue);
                
                let updatedTask = { ...task, [columnId]: finalValue };

                // ⭐️ LÓGICA DE SINCRONIZACIÓN DE DURACIÓN CON FECHA DE FIN
                if (columnId === 'duration') {
                    const newDuration = Math.max(1, finalValue); // Duración mínima de 1
                    updatedTask.duration = newDuration;
                    updatedTask.end = addDays(updatedTask.start, newDuration);
                    columnId = 'end'; // Forzar el rollup de fechas
                }
                // ⭐️ LÓGICA DE SINCRONIZACIÓN DE FECHAS CON DURACIÓN
                else if (columnId === 'start' || columnId === 'end') {
                    const duration = getDuration(updatedTask.start, updatedTask.end);
                    updatedTask.duration = Math.max(1, duration);
                }
                
                return updatedTask;
            }
            return task;
        });

        const modifiedTask = updatedTasks.find(t => t.id === id);

        // 1. Rollup de Progreso (Lógica inalterada)
        if (modifiedTask && modifiedTask.parentId && columnId === 'progress') {
            let parentIdToUpdate = modifiedTask.parentId;
            while (parentIdToUpdate) {
                const progress = calculateAggregatedProgress(parentIdToUpdate, updatedTasks);
                updatedTasks = updatedTasks.map(t => t.id === parentIdToUpdate ? { ...t, progress } : t);
                const parentTask = updatedTasks.find(t => t.id === parentIdToUpdate);
                parentIdToUpdate = parentTask ? parentTask.parentId : null;
            }
        }

        // 2. Rollup de Fechas (Se ejecuta si cambiamos 'start', 'end', o 'duration' - ya que 'duration' fuerza columnId='end')
        if (modifiedTask && modifiedTask.parentId && (columnId === 'start' || columnId === 'end')) {
            let parentIdToUpdate = modifiedTask.parentId;

            while (parentIdToUpdate) {
                const { start, end } = rollupDates(parentIdToUpdate, updatedTasks);
                updatedTasks = updatedTasks.map(t => t.id === parentIdToUpdate ? { ...t, start, end } : t);
                const parentTask = updatedTasks.find(t => t.id === parentIdToUpdate);
                parentIdToUpdate = parentTask ? parentTask.parentId : null;
            }
        }

        // 3. Ajuste de Fin/Inicio de Tarea al cambiar Inicio/Fin (Asegurar duración >= 1)
        // Ya cubierta por la lógica de duración, pero la mantenemos para asegurarnos de que la duración sea 1 si las fechas son iguales.
        if (modifiedTask && (columnId === 'start' || columnId === 'end')) {
            const duration = getDuration(modifiedTask.start, modifiedTask.end);
            if (duration <= 0) {
                const newDate = modifiedTask[columnId];
                const otherDateKey = columnId === 'start' ? 'end' : 'start';
                const newOtherDate = newDate; // Establecer la otra fecha igual a la fecha modificada (Duración 1 día)

                updatedTasks = updatedTasks.map(task => {
                    if (task.id === id) {
                        return { ...task, [otherDateKey]: newOtherDate, duration: 1 };
                    }
                    return task;
                });
            }
        }

        return updatedTasks;
    });
}, [rollupDates, calculateAggregatedProgress]);

    const deleteTask = useCallback((id) => {
        setTasks(prevTasks => {
            const taskToDelete = prevTasks.find(t => t.id === id);
            if (!taskToDelete) return prevTasks;

            // 1. Eliminar la tarea y sus descendientes
            const taskIdsToRemove = new Set();
            const findDescendants = (parentId) => {
                taskIdsToRemove.add(parentId);
                prevTasks.filter(t => t.parentId === parentId).forEach(child => findDescendants(child.id));
            };
            findDescendants(id);

            let updatedTasks = prevTasks.filter(t => !taskIdsToRemove.has(t.id));

            // 2. Quitar dependencias de la tarea eliminada
            updatedTasks = updatedTasks.map(task => {
                if (task.dependencies) {
                    const newDependencies = task.dependencies.split(',')
                        .map(dep => dep.trim())
                        .filter(dep => !taskIdsToRemove.has(dep))
                        .join(', ');
                    return { ...task, dependencies: newDependencies };
                }
                return task;
            });

            // 3. Rollup de Fechas y Progreso para el padre
            let currentParentId = taskToDelete.parentId;
            while (currentParentId) {
                const parentDates = rollupDates(currentParentId, updatedTasks);
                const parentProgress = calculateAggregatedProgress(currentParentId, updatedTasks);

                updatedTasks = updatedTasks.map(task => {
                    if (task.id === currentParentId) {
                        return { ...task, ...parentDates, progress: parentProgress };
                    }
                    return task;
                });
                const parentTask = updatedTasks.find(t => t.id === currentParentId);
                currentParentId = parentTask ? parentTask.parentId : null;
            }

            return updatedTasks;
        });
    }, [rollupDates, calculateAggregatedProgress]);

    const toggleCollapse = useCallback((taskId) => {
        setCollapsedParents(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    }, []);

    // --------------------------------------------------------------------------------------
    // 4. LÓGICA DE GESTIÓN DE COLUMNAS DINÁMICAS
    // --------------------------------------------------------------------------------------

    const handleColumnAddition = useCallback(() => {
        if (!newColumnName.trim()) return;

        const typeDef = availableColumnTypes.find(t => t.id === newColumnType);
        const baseId = `Custom${Date.now().toString().slice(-4)}`;
        let newColumns = [];

        // Manejo de la columna 'cost' como doble columna 
        if (newColumnType === 'cost') {
            newColumns = [
                { id: `${baseId}_budget`, header: `${newColumnName} (Presup.)`, defaultSize: 100, accessorKey: `${baseId}_budget`, type: 'number' },
                { id: `${baseId}_actual`, header: `${newColumnName} (Real)`, defaultSize: 100, accessorKey: `${baseId}_actual`, type: 'number' },
            ];
        } else {
            newColumns = [
                { id: baseId, header: newColumnName, defaultSize: typeDef.size, accessorKey: baseId, type: newColumnType },
            ];
        }

        setDynamicColumns(prev => [...prev, ...newColumns]);

        setColumnWidths(prev => {
            const newWidths = {};
            newColumns.forEach(col => { newWidths[col.id] = col.defaultSize; });
            return { ...prev, ...newWidths };
        });

        setTasks(prevTasks => prevTasks.map(task => {
            let taskUpdate = { ...task };
            newColumns.forEach(col => {
                const initialValue = typeDef.initialValue;
                const finalValue = (col.type === 'number' || col.type === 'cost') ? parseFloat(initialValue) : initialValue;
                taskUpdate[col.accessorKey] = finalValue;
            });
            return taskUpdate;
        }));

        setIsAddingColumn(false);
        setNewColumnName('Campo Personalizado');
        setNewColumnType('text');
    }, [newColumnName, newColumnType, setTasks]);

    const handleDeleteDynamicColumn = useCallback((columnId) => {
        setDynamicColumns(prev => prev.filter(col => col.id !== columnId));
        setColumnWidths(prev => {
            const { [columnId]: removedWidth, ...restWidths } = prev;
            return restWidths;
        });
        setTasks(prevTasks => prevTasks.map(task => {
            // Usamos columnId para eliminar la propiedad por su accessorKey (que es igual al id)
            const { [columnId]: removedValue, ...restTask } = task; 
            return restTask;
        }));
    }, []);

    const updateColumnHeader = useCallback((columnId, newHeader) => {
        if (newHeader.trim() === '') return;
        setDynamicColumns(prev =>
            prev.map(col => col.id === columnId ? { ...col, header: newHeader } : col)
        );
    }, []);


    // --------------------------------------------------------------------------------------
    // 5. LÓGICA DE REDIMENSIONAMIENTO DE COLUMNA
    // --------------------------------------------------------------------------------------

    const startResizing = useCallback((columnId, e) => {
        e.preventDefault();
        e.stopPropagation();

        setIsColumnResizingActive(true);

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const initialWidth = columnWidths[columnId] || columns.find(c => c.id === columnId)?.defaultSize || 100;

        columnResizingInfo.current = {
            isResizing: true,
            currentColumnId: columnId,
            startX: clientX,
            startWidth: initialWidth,
        };

        const handleMouseMove = (moveEvent) => {
            const { current } = columnResizingInfo;
            if (!current.isResizing) return;

            const moveClientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const deltaX = moveClientX - current.startX;

            const newWidth = Math.max(MIN_COLLAPSED_WIDTH, current.startWidth + deltaX);

            setColumnWidths(prev => ({
                ...prev,
                [current.currentColumnId]: newWidth,
            }));
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);

            columnResizingInfo.current.isResizing = false;
            columnResizingInfo.current.currentColumnId = null;
            setIsColumnResizingActive(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleMouseMove);
        window.addEventListener('touchend', handleMouseUp);

    }, [columnWidths, columns]);


    const toggleColumnCollapse = useCallback((columnId) => {
        setColumnWidths(prevWidths => {
            const currentWidth = prevWidths[columnId];

            if (currentWidth <= MIN_COLLAPSED_WIDTH) {
                // COLAPSADA -> DESCOLAPSAR
                const restoredWidth = savedColumnWidths[columnId] ||
                    columns.find(c => c.id === columnId)?.defaultSize ||
                    DEFAULT_RESTORE_WIDTH;
                return { ...prevWidths, [columnId]: restoredWidth };
            } else {
                // DESCOLAPSADA -> COLAPSAR
                setSavedColumnWidths(prevSaved => ({ ...prevSaved, [columnId]: currentWidth }));
                return { ...prevWidths, [columnId]: MIN_COLLAPSED_WIDTH };
            }
        });
    }, [savedColumnWidths, columns]);


    // --------------------------------------------------------------------------------------
    // 6. HANDLERS DE REDIMENSIONAMIENTO DEL DIVISOR CENTRAL (Panel Gantt/Tabla)
    // --------------------------------------------------------------------------------------
    const startPanelResize = useCallback((e) => {
        setIsPanelResizing(true);
        e.preventDefault();
    }, []);

    const stopPanelResize = useCallback(() => {
        setIsPanelResizing(false);
    }, []);

    const onPanelResize = useCallback((e) => {
        if (!isPanelResizing || !containerRef.current) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const containerBounds = containerRef.current.getBoundingClientRect();
        const newWidthPx = clientX - containerBounds.left;
        const newWidthPercent = (newWidthPx / containerBounds.width) * 100;

        if (newWidthPercent > 15 && newWidthPercent < 85) {
            setLeftPanelWidth(newWidthPercent);
        }
    }, [isPanelResizing]);

    useEffect(() => {
        if (isPanelResizing) {
            window.addEventListener('mousemove', onPanelResize);
            window.addEventListener('mouseup', stopPanelResize);
            window.addEventListener('touchmove', onPanelResize);
            window.addEventListener('touchend', stopPanelResize);
        }
        return () => {
            window.removeEventListener('mousemove', onPanelResize);
            window.removeEventListener('mouseup', stopPanelResize);
            window.removeEventListener('touchmove', onPanelResize);
            window.removeEventListener('touchend', stopPanelResize);
        };
    }, [isPanelResizing, onPanelResize, stopPanelResize]);

    // --------------------------------------------------------------------------------------
    // 7. SCROLL Y OTRAS UTILIDADES
    // --------------------------------------------------------------------------------------
    const handleScroll = (scrollingElement, targetRef) => {
        if (targetRef.current && scrollingElement !== targetRef.current) {
            targetRef.current.scrollTop = scrollingElement.scrollTop;
        }
    };
    const onTableScroll = (e) => handleScroll(e.currentTarget, ganttScrollRef);
    const onGanttScroll = (e) => handleScroll(e.currentTarget, tableScrollRef);

    // --------------------------------------------------------------------------------------
    // 8. COMPONENTE DE EDICIÓN DE ENCABEZADO (Definido aquí para accesibilidad de props)
    // --------------------------------------------------------------------------------------
    const HeaderEditor = ({ column, updateHeader, dynamicColumns, handleDeleteDynamicColumn }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [inputValue, setInputValue] = useState(column.header);
        // Las columnas dinámicas son las que no están en 'defaultColumnsDef'
        const isDynamic = dynamicColumns.some(c => c.id === column.id) || dynamicColumns.some(c => c.id.startsWith(column.id.split('_')[0]));


        const handleBlur = () => {
            if (inputValue.trim() && inputValue !== column.header) {
                updateHeader(column.id, inputValue);
            } else {
                setInputValue(column.header);
            }
            setIsEditing(false);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Enter') handleBlur();
        };

        if (isEditing) {
            return (
                <input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    style={{ border: '1px solid #4F46E5', padding: '2px', width: '90%' }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                />
            );
        }

        return (
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <span
                    onDoubleClick={() => isDynamic && setIsEditing(true)}
                    title={isDynamic ? "Doble clic para editar" : column.header}
                    style={{ flexGrow: 1, cursor: isDynamic ? 'text' : 'default', minHeight: '20px', display: 'inline-block' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {column.header}
                </span>
                {isDynamic && (
                    <button
                        className="delete-col-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDynamicColumn(column.id);
                        }}
                        title="Eliminar Columna"
                        style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', marginLeft: '5px' }}
                    >
                        &times;
                    </button>
                )}
            </div>
        );
    };


    // --------------------------------------------------------------------------------------
    // 9. ESTILOS INLINE
    // --------------------------------------------------------------------------------------
    const mainAppStyle = { padding: '20px', fontFamily: 'Inter, Arial, sans-serif', backgroundColor: '#F9FAFB' };
    const headerStyle = { marginBottom: '20px', color: '#1F2937' };
    const controlsContainerStyle = { marginBottom: '15px', borderBottom: '1px solid #D1D5DB', paddingBottom: '10px', backgroundColor: "white", borderRadius: '8px', padding: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexWrap: 'wrap', alignItems: 'center' };
    const controlItemStyle = { display: 'inline-block', marginRight: '15px', verticalAlign: 'middle' };
    const buttonStyle = { padding: '8px 15px', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', display: 'inline-block', transition: 'background-color 0.2s' };
    const secondaryButtonStyle = { ...buttonStyle, backgroundColor: '#10B981', padding: '8px 10px', marginRight: '15px' };
    const splitContainerStyle = {
        display: 'flex',
        height: '80vh',
        border: '1px solid #D1D5DB',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    };
    const tableContainerStyle = { overflow: 'auto', height: '100%', backgroundColor: 'white' };
    const tableHeaderRowStyle = { backgroundColor: '#F3F4F6', borderBottom: '2px solid #D1D5DB' };
    const tableRowStyle = { height: `${ROW_HEIGHT_PX}px`, borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' };
    const viewModeControlsStyle = { marginLeft: 'auto', paddingTop: '3px' };
    const inputStyle = { padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '5px', width: '200px', marginLeft: '10px', fontSize: '14px' };
    const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 };
    const modalContentStyle = { backgroundColor: 'white', padding: '30px', borderRadius: '8px', minWidth: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' };


    const tableHeaderCellStyle = (columnId) => ({
        width: columnWidths[columnId] ? `${columnWidths[columnId]}px` : 'auto',
        minWidth: columnWidths[columnId] ? `${columnWidths[columnId]}px` : 'auto',
        position: 'sticky',
        top: 0,
        padding: '8px',
        textAlign: 'left',
        borderRight: '1px solid #E5E7EB',
        fontSize: '14px',
        color: '#374151',
        fontWeight: 'bold',
        zIndex: 1,
        backgroundColor: '#F3F4F6',
        paddingRight: '0px',
    });

    const tableCellWrapperStyle = (columnId) => ({
        padding: 0,
        borderRight: '1px solid #E5E7EB',
        verticalAlign: 'top',
        width: columnWidths[columnId] ? `${columnWidths[columnId]}px` : 'auto',
        minWidth: columnWidths[columnId] ? `${columnWidths[columnId]}px` : 'auto',
    });


    // --------------------------------------------------------------------------------------
    // 10. RENDERIZADO (JSX)
    // --------------------------------------------------------------------------------------
    return (
        <div style={mainAppStyle}>
            <h1 style={headerStyle}>Gestor de Proyectos</h1>

            {/* --- Modal --- */}
            {isAddingColumn && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#1F2937' }}>Agregar Nueva Columna</h2>

                        <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                            Nombre de la Columna:
                            <input
                                type="text"
                                value={newColumnName}
                                onChange={(e) => setNewColumnName(e.target.value)}
                                style={inputStyle}
                            />
                        </label>

                        <label style={{ display: 'block', marginBottom: '20px', fontWeight: '600' }}>
                            Tipo de Dato:
                            <select
                                value={newColumnType}
                                onChange={(e) => setNewColumnType(e.target.value)}
                                style={inputStyle}
                            >
                                {availableColumnTypes.map(type => (
                                    <option key={type.id} value={type.id}>
                                        {type.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                onClick={() => setIsAddingColumn(false)}
                                style={{ ...buttonStyle, backgroundColor: '#6B7280' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleColumnAddition}
                                disabled={!newColumnName.trim()}
                                style={{ ...secondaryButtonStyle, margin: 0 }}
                            >
                                Agregar Columna(s)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={controlsContainerStyle}>
                <div style={controlItemStyle}>
                    <button onClick={() => addNewTask(null)} style={buttonStyle}>+ Tarea Principal</button>
                </div>
                <div style={controlItemStyle}>
                    <button
                        onClick={() => setIsAddingColumn(true)}
                        style={secondaryButtonStyle}
                    >
                        + Columna Personalizada
                    </button>
                </div>

                {/* 🔍 BUSCADOR DE TAREAS Y CHECKBOX DE PADRES */}
                <div style={{ ...controlItemStyle, marginLeft: '30px' }}>
                    <label>
                        Buscar Tarea:
                        <input
                            type="text"
                            placeholder="Filtrar por nombre..."
                            value={taskSearchTerm}
                            onChange={(e) => setTaskSearchTerm(e.target.value)}
                            style={inputStyle}
                        />
                    </label>

                    <label style={{ marginLeft: '15px' }}>
                        Incluir Padres
                        <input
                            type="checkbox"
                            checked={showParentChain}
                            onChange={(e) => setShowParentChain(e.target.checked)}
                            style={{ marginLeft: '5px' }}
                        />
                    </label>

                </div>

                <div style={viewModeControlsStyle}>
                    {Object.keys(ViewMode).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            style={{
                                ...buttonStyle,
                                backgroundColor: viewMode === mode ? '#1E40AF' : '#6366F1',
                                padding: '6px 12px', fontSize: '12px', marginRight: '5px'
                            }}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            <div ref={containerRef} style={splitContainerStyle}>

                <div style={{ width: `${leftPanelWidth}%`, flexShrink: 0 }}>
                    <div ref={tableScrollRef} style={tableContainerStyle} onScroll={onTableScroll}>
                        <table style={{ minWidth: totalTableWidth, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                                <tr style={tableHeaderRowStyle}>
                                    {columns.map(column => (
                                        <th key={column.id} style={tableHeaderCellStyle(column.id)}>
                                            <div
                                                style={{
                                                    position: 'relative',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    height: '100%',
                                                    paddingRight: '5px',
                                                    cursor: (columnWidths[column.id] && columnWidths[column.id] <= MIN_COLLAPSED_WIDTH)
                                                        ? 'pointer'
                                                        : 'default'
                                                }}
                                                // MANEJADOR DE COLAPSO/RESTAURACIÓN DE COLUMNA
                                                onClick={() => toggleColumnCollapse(column.id)}
                                            >

                                                {/* ⭐️ CORRECCIÓN PRINCIPAL: Este div maneja el título, el indicador y el clic de ordenación */}
                                                <div
                                                    // CURSOR: Puntero si es ordenable
                                                    style={{ 
                                                        flexGrow: 1, 
                                                        display: 'flex', 
                                                        alignItems: 'center',
                                                        cursor: (column.accessorKey && column.accessorKey !== 'index') ? 'pointer' : 'default' 
                                                    }}
                                                    // HANDLER DE ORDENACIÓN
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        // Solo ordenar si no es la columna 'index'
                                                        if (column.accessorKey && column.accessorKey !== 'index') handleSort(column.accessorKey); 
                                                    }}
                                                >
                                                    
                                                    {/* Renderizado y Edición del Encabezado */}
                                                    <HeaderEditor
                                                        column={column}
                                                        updateHeader={updateColumnHeader}
                                                        dynamicColumns={dynamicColumns}
                                                        handleDeleteDynamicColumn={handleDeleteDynamicColumn}
                                                    />

                                                    {/* ⭐️ INDICADOR DE ORDENAMIENTO (Ahora dentro del área de clic y alineado) */}
                                                    <span style={{ marginLeft: '5px', color: '#1F2937', lineHeight: '1' }}>
                                                        {getSortIndicator(column.accessorKey)}
                                                    </span>

                                                </div>
                                                
                                                {/* 📏 EL HANDLE DE REDIMENSIONAMIENTO (DRAG AND DROP) */}
                                                <div
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        startResizing(column.id, e);
                                                    }}
                                                    onTouchStart={(e) => {
                                                        e.stopPropagation();
                                                        startResizing(column.id, e);
                                                    }}
                                                    style={{
                                                        position: 'absolute',
                                                        right: '-8px',
                                                        top: 0,
                                                        width: '16px',
                                                        cursor: 'col-resize',
                                                        height: '100%',
                                                        backgroundColor: (columnResizingInfo.current.isResizing && columnResizingInfo.current.currentColumnId === column.id) ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                                                        zIndex: 30,
                                                    }}
                                                />
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTasks.map((task) => (
                                    <tr key={task.id} style={tableRowStyle}>
                                        {columns.map(column => (
                                            <td
                                                key={`${task.id}-${column.id}`}
                                                style={tableCellWrapperStyle(column.id)}
                                            >
                                                <EditableCell
                                                    initialValue={task[column.accessorKey] ?? ''}
                                                    task={task}
                                                    columnId={column.accessorKey}
                                                    updateTaskData={updateTaskData}
                                                    allTasks={fullTaskData}
                                                    parentIds={parentIds}
                                                    collapsedParents={collapsedParents}
                                                    toggleCollapse={toggleCollapse}
                                                    addNewTask={addNewTask}
                                                    addNewMilestone={addNewMilestone}
                                                    deleteTask={deleteTask}
                                                />

                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* --- DIVISOR CENTRAL (Panel Redimensionable) --- */}
                <div
                    onMouseDown={startPanelResize}
                    onTouchStart={startPanelResize}
                    style={{ width: '10px', cursor: 'col-resize', backgroundColor: '#D1D5DB', flexShrink: 0 }}
                />

                {/* --- PANEL GANTT --- */}
                <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                    <CustomGantt
                        tasks={visibleTasks}
                        viewMode={viewMode}
                        scrollRef={ganttScrollRef}
                        onScroll={onGanttScroll}
                        rowHeight={ROW_HEIGHT_PX}
                    />
                </div>
            </div>

            {/* Estilo global para cambiar el cursor en todo el cuerpo durante el arrastre */}
            {(isColumnResizingActive || isPanelResizing) && (
                <style>{`body { cursor: col-resize !important; user-select: none; }`}</style>
            )}
        </div>
    );
};

export default TableGantt;