import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';

// --- CONSTANTES ---
const BAR_HEIGHT = 34;
const BAR_PADDING = 8;
const ROW_HEIGHT_PX = BAR_HEIGHT + BAR_PADDING * 2;
const ViewMode = { Day: 'Day', Week: 'Week', Month: 'Month', Year: 'Year' };

// --- TAREAS INICIALES ---
const initialTasks = [
    { id: 'T1', name: 'Fase de Planificación', start: '2025-11-01', end: '2025-11-15', progress: 100, parentId: null, cost: 5000, priority: 'Alta', dependencies: '' },
    { id: 'S1-1', name: 'Definir Alcance', start: '2025-11-01', end: '2025-11-07', progress: 100, parentId: 'T1', cost: 2000, priority: 'Media', dependencies: 'T1' },
    { id: 'S1-2', name: 'Requisitos de Stakeholders', start: '2025-11-08', end: '2025-11-15', progress: 90, parentId: 'T1', cost: 3000, priority: 'Alta', dependencies: 'S1-1' },
    { id: 'M1', name: 'Hito: Aprobación de Alcance', start: '2025-11-15', end: '2025-11-15', progress: 100, parentId: 'T1', cost: 0, priority: 'Alta', dependencies: 'S1-2' }, // Depende de S1-2
    { id: 'T2', name: 'Desarrollo Core', start: '2025-11-16', end: '2025-12-10', progress: 70, parentId: null, cost: 15000, priority: 'Alta', dependencies: 'M1' }, // Depende de M1
    { id: 'S2-1', name: 'Codificación Módulo A', start: '2025-11-16', end: '2025-11-30', progress: 80, parentId: 'T2', cost: 5000, priority: 'Alta', dependencies: 'T2' },
    { id: 'S2-2', name: 'Integración de API', start: '2025-12-01', end: '2025-12-10', progress: 50, parentId: 'T2', cost: 10000, priority: 'Media', dependencies: 'S2-1' }, // Depende de S2-1 (Cambié la fecha de inicio a 01/12 para que sea crítica)
    { id: 'T3', name: 'Pruebas e Implementación', start: '2025-12-11', end: '2025-12-30', progress: 30, parentId: null, cost: 8000, priority: 'Baja', dependencies: 'S2-2' }, // Depende de T2
    { id: 'S3-1', name: 'Beta Testing', start: '2025-12-11', end: '2025-12-20', progress: 50, parentId: 'T3', cost: 3000, priority: 'Media', dependencies: 'T3' },
    { id: 'S3-2', name: 'Despliegue Final', start: '2025-12-21', end: '2025-12-30', progress: 10, parentId: 'T3', cost: 5000, priority: 'Alta', dependencies: 'S3-1' }, // Depende de S3-1
];

// --- FUNCIONES DE UTILIDAD DE FECHA PARA CPM y ROLLUP ---

// Calcula la duración en días calendario (incluye ambos días)
const getDurationInDays = (startStr, endStr) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start) || isNaN(end)) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir el día de inicio
    return diffDays;
};

// Suma días a una fecha (devuelve string YYYY-MM-DD)
const addDays = (dateStr, days) => {
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

// Compara dos fechas y devuelve la más temprana
const minDate = (dateStrA, dateStrB) => {
    if (!dateStrA) return dateStrB;
    if (!dateStrB) return dateStrA;
    return (new Date(dateStrA) < new Date(dateStrB)) ? dateStrA : dateStrB;
};

// Compara dos fechas y devuelve la más tardía
const maxDate = (dateStrA, dateStrB) => {
    if (!dateStrA) return dateStrB;
    if (!dateStrB) return dateStrA;
    return (new Date(dateStrA) > new Date(dateStrB)) ? dateStrA : dateStrB;
};

// --- LÓGICA DE CÁLCULO DE RUTA CRÍTICA (CPM) ---

const useCriticalPathData = (tasks) => {
    return useMemo(() => {
        if (!tasks.length) return { criticalTasks: [], fullTaskData: [] };

        const taskData = new Map();
        tasks.forEach(task => {
            const duration = getDurationInDays(task.start, task.end);
            taskData.set(task.id, {
                ...task,
                duration: duration,
                ES: null, // Early Start
                EF: null, // Early Finish
                LS: null, // Late Start
                LF: null, // Late Finish
                Float: null, // Holgura
                successors: [], // Se llenará en el paso de mapeo
            });
        });

        // 1. Mapeo de Sucesores
        tasks.forEach(task => {
            const dependencies = task.dependencies ? task.dependencies.split(',').map(id => id.trim()).filter(Boolean) : [];
            dependencies.forEach(depId => {
                const predecessor = taskData.get(depId);
                if (predecessor) {
                    predecessor.successors.push(task.id);
                }
            });
        });

        // 2. Pase Adelante (Forward Pass) para ES y EF
        let changed;
        let iterationCount = 0;
        const maxIterations = tasks.length * 2; 

        do {
            changed = false;
            iterationCount++;

            tasks.forEach(task => {
                const currentData = taskData.get(task.id);
                let newES = currentData.start; 

                const dependencies = task.dependencies ? task.dependencies.split(',').map(id => id.trim()).filter(Boolean) : [];

                if (dependencies.length > 0) {
                    let maxEF = null;

                    dependencies.forEach(depId => {
                        const predecessor = taskData.get(depId);
                        if (predecessor && predecessor.EF) {
                            // Finish-to-Start: ES de la tarea actual es el día después del EF de la predecesora.
                            const potentialES = addDays(predecessor.EF, 1);
                            if (!maxEF || potentialES > maxEF) {
                                maxEF = potentialES;
                            }
                        }
                    });

                    // El ES de la tarea es el máximo entre su fecha de inicio y el maxEF de sus predecesoras.
                    if (maxEF && maxEF > newES) {
                         newES = maxEF;
                    }
                }

                // Calcular el nuevo EF
                const newEF = addDays(newES, currentData.duration - 1); 

                if (newES !== currentData.ES || newEF !== currentData.EF) {
                    currentData.ES = newES;
                    currentData.EF = newEF;
                    changed = true;
                }
            });

            if (iterationCount > maxIterations) {
                console.warn("Advertencia: Se detectó un posible bucle de dependencia. Deteniendo el pase adelante.");
                break;
            }
        } while (changed);

        // 3. Obtener la Fecha de Finalización del Proyecto (Project Finish Date)
        let projectFinishDate = new Date(0);
        taskData.forEach(task => {
            if (task.EF) {
                const efDate = new Date(task.EF);
                if (efDate > projectFinishDate) {
                    projectFinishDate = efDate;
                }
            }
        });

        const projectFinishDateStr = projectFinishDate.toISOString().split('T')[0];

        // 4. Pase Atrás (Backward Pass) para LF y LS
        // Inicializar el LF de las tareas finales (sin sucesores) al Project Finish Date.
        taskData.forEach(task => {
            if (task.successors.length === 0) {
                task.LF = projectFinishDateStr;
                task.LS = addDays(task.LF, -(task.duration - 1));
            }
        });

        let changedBackward;
        iterationCount = 0;

        do {
            changedBackward = false;
            iterationCount++;
            
            for (let i = tasks.length - 1; i >= 0; i--) {
                const task = tasks[i];
                const currentData = taskData.get(task.id);

                if (currentData.successors.length > 0) {
                    let minLS = null;

                    currentData.successors.forEach(succId => {
                        const successor = taskData.get(succId);
                        if (successor && successor.LS) {
                            // El LF de la tarea actual es el día antes del LS de la sucesora.
                            const potentialLF = addDays(successor.LS, -1);
                            if (!minLS || potentialLF < minLS) {
                                minLS = potentialLF;
                            }
                        }
                    });

                    // Si minLS está definido, actualizar el LF y LS
                    if (minLS) {
                        // Solo actualizar si el nuevo LF es más temprano que el actual, o si el actual es nulo
                        if (!currentData.LF || minLS < currentData.LF) {
                            currentData.LF = minLS;
                            currentData.LS = addDays(currentData.LF, -(currentData.duration - 1));
                            changedBackward = true;
                        }
                    }
                }
            }

            if (iterationCount > maxIterations) {
                console.warn("Advertencia: Se detectó un posible bucle de dependencia. Deteniendo el pase atrás.");
                break;
            }
        } while (changedBackward);

        // 5. Calcular Holgura (Float) e identificar la Ruta Crítica
        const criticalTasks = [];
        const finalTaskData = [];

        taskData.forEach(task => {
            // Calcular Holgura: Float = Días entre LF y EF
            let Float = 0;
            if (task.LF && task.EF) {
                const lfDate = new Date(task.LF);
                const efDate = new Date(task.EF);
                Float = Math.round((lfDate.getTime() - efDate.getTime()) / (1000 * 60 * 60 * 24)); // Redondear para evitar errores de coma flotante
            }
            task.Float = Float;
            task.isCritical = task.Float === 0;

            if (task.isCritical) {
                criticalTasks.push(task.id);
            }
            finalTaskData.push(task);
        });

        // Retornamos las tareas enriquecidas con datos CPM
        return { criticalTasks, fullTaskData: finalTaskData };

    }, [tasks]);
};

// --- LÓGICA DE HERRAMIENTAS ---
const getTaskDepth = (task, allTasks, depth = 0) => {
    if (!task.parentId) return depth;
    const parent = allTasks.find(t => t.id === task.parentId);
    return parent ? getTaskDepth(parent, allTasks, depth + 1) : depth;
};

const isTaskHidden = (task, collapsedParents, allTasks) => {
    let currentTask = task;
    while (currentTask.parentId) {
        if (collapsedParents[currentTask.parentId]) {
            return true;
        }
        currentTask = allTasks.find(t => t.id === task.parentId);
        if (!currentTask) break;
    }
    return false;
};

// --- COMPONENTE DE CELDA EDITABLE ---
const EditableCell = ({ value: initialValue, task, columnId, allTasks, updateTaskData, parentIds, collapsedParents, toggleCollapse, addNewTask, addNewMilestone }) => {
    const safeInitialValue = String(initialValue ?? '');
    const [value, setValue] = useState(safeInitialValue);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        setValue(safeInitialValue);
    }, [safeInitialValue]);

    const onBlur = () => {
        setIsEditing(false);
        if (String(value) !== String(initialValue)) {
            updateTaskData(task.id, columnId, value);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onBlur();
        } else if (e.key === 'Escape') {
            setValue(safeInitialValue);
            setIsEditing(false);
        }
    };

    const handleDoubleClick = () => {
        // No permitir edición de ID, Holgura, ni padres si son rollup
        if (columnId === 'id' || columnId === 'Float' || (parentIds.has(task.id) && (columnId === 'start' || columnId === 'end'))) {
             return;
        }
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const inputStyle = {
        width: '100%',
        height: '100%',
        padding: '0.5rem',
        border: '1px solid #4f46e5',
        borderRadius: '4px',
        boxSizing: 'border-box',
        outline: 'none',
        fontSize: '0.875rem',
        backgroundColor: 'white',
        color: '#1f2937',
        ...(columnId === 'start' || columnId === 'end' ? { fontSize: '0.75rem' } : {})
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                value={value}
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={handleKeyDown}
                style={inputStyle}
                type={columnId === 'cost' || columnId === 'progress' ? 'number' : columnId === 'start' || columnId === 'end' ? 'date' : 'text'}
            />
        );
    }

    const defaultCellStyle = {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '0.5rem',
        boxSizing: 'border-box',
        fontSize: '0.875rem',
        color: '#1f2937',
        minWidth: '20px',
        backgroundColor: 'white',
        cursor: columnId === 'name' ? 'default' : 'pointer',
        // Estilo especial para fechas de tareas padre (Rollup)
        ...(parentIds.has(task.id) && (columnId === 'start' || columnId === 'end') ? { 
            backgroundColor: '#e0f2f1', // Fondo más claro para indicar que son calculadas
            fontWeight: 'bold',
            color: '#047878', // Color teal
            cursor: 'default',
        } : {}),
    };

    if (columnId === 'name') {
        const isParent = parentIds.has(task.id);
        const isMilestone = task.start === task.end;
        const isCollapsed = collapsedParents[task.id];
        const depth = getTaskDepth(task, allTasks);

        const toggleIconStyle = {
            cursor: 'pointer',
            transition: 'transform 0.15s',
            transform: isCollapsed ? 'rotate(90deg)' : 'rotate(0deg)',
            lineHeight: '1',
            fontSize: '10px',
            minWidth: '16px',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
        };

        const toggleIcon = isParent ? (
            <span
                onClick={() => toggleCollapse(task.id)}
                style={toggleIconStyle}
            >
                &#9658;
            </span>
        ) : (
            <span style={{ minWidth: '16px', opacity: 0, visibility: 'hidden', fontSize: '10px', flexShrink: 0 }}>&#9658;</span>
        );

        const nameCellStyle = {
            ...defaultCellStyle,
            paddingLeft: `${depth * 20 + 8}px`,
            backgroundColor: isCollapsed ? '#f3f4f6' : 'transparent',
            cursor: 'pointer',
            // Resaltar las tareas críticas en la tabla también
            fontWeight: task.isCritical ? 'bold' : 'normal',
            color: task.isCritical ? '#ef4444' : '#1f2937',
        };

        const textWrapperStyle = {
            flexGrow: 1,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            marginRight: '8px',
        };

        const addSubtaskIcon = (
            <span
                onClick={(e) => { e.stopPropagation(); addNewTask(task.id); }}
                style={{
                    cursor: 'pointer',
                    fontSize: '1rem',
                    color: '#10b981',
                    minWidth: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.8,
                    transition: 'opacity 0.15s',
                    fontWeight: 'bold',
                    flexShrink: 0,
                }}
                title="Agregar Subtarea"
            >
                +
            </span>
        );

        const addSubMilestoneIcon = (
            <span
                onClick={(e) => { e.stopPropagation(); addNewMilestone(task.id); }}
                style={{
                    cursor: 'pointer',
                    marginLeft: '4px',
                    fontSize: '1rem',
                    color: '#f59e0b',
                    minWidth: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.8,
                    transition: 'opacity 0.15s',
                    fontWeight: 'bold',
                    flexShrink: 0,
                }}
                title="Agregar Sub-Hito"
            >
                ◊
            </span>
        );


        return (
            <div
                style={nameCellStyle}
                onDoubleClick={handleDoubleClick}
            >
                {toggleIcon}

                <div style={textWrapperStyle}>
                    {isMilestone ? '💎 ' : ''}{value}
                </div>

                {isParent && (
                    <>
                        {addSubtaskIcon}
                        {addSubMilestoneIcon}
                    </>
                )}
            </div>
        );
    }

    let formattedValue = value;
    if (columnId === 'cost') {
        formattedValue = `$${(parseFloat(value) || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } else if (columnId === 'progress') {
        formattedValue = `${parseInt(value, 10) || 0}%`;
    } else if (columnId === 'dependencies') {
        formattedValue = value.split(',').map(id => id.trim()).filter(id => id).join(', ');
        if(formattedValue) {
             formattedValue = <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>{formattedValue}</span>
        }
    } else if (columnId === 'Float' && task.Float !== null) {
        // Mostrar la holgura (Float) si el cálculo de CPM está disponible
        formattedValue = <span style={{ color: task.isCritical ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>{task.Float} días</span>;
    }


    return (
        <div
            onDoubleClick={handleDoubleClick}
            style={defaultCellStyle}
        >
            {formattedValue || (formattedValue === 0 ? '0' : <span dangerouslySetInnerHTML={{ __html: '&nbsp;' }} />)}
        </div>
    );
};

// --- COMPONENTE DE VISUALIZACIÓN GANTT ---
const CustomGantt = ({ tasks, viewMode, scrollRef, onScroll }) => {
    const barHeight = BAR_HEIGHT;
    const barPadding = BAR_PADDING;
    const rowHeight = ROW_HEIGHT_PX;

    const headerHeight = 45;
    const today = new Date();

    const taskMap = useMemo(() => new Map(tasks.map((t, index) => [t.id, { ...t, index }])), [tasks]);

    const { start: projectStart, end: projectEnd } = useMemo(() => {
        if (tasks.length === 0) return { start: today, end: today };
        const validDates = tasks
            .flatMap(t => [t.start, t.end])
            .filter(d => d)
            .map(d => new Date(d).getTime())
            .filter(t => !isNaN(t));

        if (validDates.length === 0) return { start: today, end: today };

        return {
            start: new Date(Math.min(...validDates)),
            end: new Date(Math.max(...validDates)),
        };
    }, [tasks]);

    const scaleFactor = useMemo(() => {
        switch (viewMode) {
            case ViewMode.Day: return 100;
            case ViewMode.Week: return 40;
            case ViewMode.Month: return 20;
            case ViewMode.Year: return 5;
            default: return 30;
        }
    }, [viewMode]);
    const daysInProject = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const svgWidth = daysInProject * scaleFactor + 50;

    const timeAxis = useMemo(() => {
        const axis = [];
        // Empezar a dibujar desde el inicio del proyecto (o un poco antes para contexto)
        let currentDate = new Date(projectStart);
        currentDate.setHours(0, 0, 0, 0); 
        
        // Ajustar el inicio del dibujo a la primera semana/mes
        const startDay = new Date(projectStart);
        startDay.setDate(startDay.getDate() - 7); // Retroceder una semana por contexto

        currentDate = startDay;


        let lastMonth = -1;
        while (currentDate.getTime() <= projectEnd.getTime() + (1000 * 60 * 60 * 24 * 7)) { // +7 días extra al final
            const daysDifference = Math.ceil((currentDate.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
            const dayOfYear = daysDifference >= 0 ? daysDifference : 0;

            const isNewMonth = currentDate.getMonth() !== lastMonth;

            axis.push({
                date: new Date(currentDate),
                x: dayOfYear * scaleFactor,
                isNewMonth: isNewMonth,
                monthName: isNewMonth ? currentDate.toLocaleString('es-ES', { month: 'short', year: 'numeric' }) : null,
            });

            lastMonth = currentDate.getMonth();
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return axis;
    }, [projectStart, projectEnd, scaleFactor]);

    const getXPosition = useCallback((dateString) => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 0;
        const daysDifference = Math.ceil((date.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
        return daysDifference * scaleFactor;
    }, [projectStart, scaleFactor]);

    const taskBars = tasks.map((task, index) => {
        if (!task.start || !task.end || isNaN(new Date(task.start).getTime()) || isNaN(new Date(task.end).getTime())) {
            return null;
        }

        const xStart = getXPosition(task.start);
        const xEnd = getXPosition(task.end) + scaleFactor;
        const width = xEnd - xStart;
        const y = headerHeight + index * rowHeight + barPadding;

        const isMilestone = task.start === task.end;
        // Color para la Ruta Crítica
        const criticalColor = '#ef4444';
        // Las tareas padre usan un color gris más oscuro para diferenciarse, las hijas usan color del nivel 2
        const nonCriticalColor = task.parentId ? 'rgb(109, 40, 217)' : 'rgb(59, 130, 246)'; 
        const bgColor = task.isCritical ? criticalColor : nonCriticalColor;

        const progressWidth = width * (task.progress / 100);

        if (isMilestone) {
            return (
                <g key={task.id} style={{ cursor: 'pointer' }}>
                    {/* Hito: Diamante, coloreado según si es crítico */}
                    <rect x={xStart} y={y - 8} width={16} height={16} fill={bgColor} transform={`rotate(45 ${xStart + 8} ${y})`} />
                    <title>{`${task.name} (Hito) - ${task.start} - ${task.isCritical ? 'CRÍTICO' : 'No Crítico'}`}</title>
                </g>
            );
        }

        return (
            <g key={task.id} style={{ cursor: 'pointer' }}>
                {/* Barra de fondo */}
                <rect x={xStart} y={y} width={width} height={barHeight} fill="#e5e7eb" rx="3" />
                {/* Barra de progreso - Usa el color crítico si aplica */}
                <rect x={xStart} y={y} width={progressWidth} height={barHeight} fill={bgColor} rx="3" />
                {/* Texto de información al pasar el mouse */}
                <title>{`${task.name} (${task.progress}%) - ${task.start} a ${task.end} - ${task.isCritical ? 'CRÍTICO' : 'No Crítico'}`}</title>
            </g>
        );
    }).filter(Boolean);

    // LÓGICA PARA DIBUJAR LÍNEAS DE DEPENDENCIA
    const dependencyLines = useMemo(() => {
        const lines = [];

        tasks.forEach(task => {
            const dependencyIds = task.dependencies ? task.dependencies.split(',').map(id => id.trim()).filter(Boolean) : [];

            if (dependencyIds.length > 0) {
                dependencyIds.forEach(depId => {
                    const predecessorTask = taskMap.get(depId);
                    const successorTask = taskMap.get(task.id);

                    if (predecessorTask && successorTask) {
                        const depXEnd = getXPosition(predecessorTask.end) + scaleFactor;
                        const depYCenter = headerHeight + predecessorTask.index * rowHeight + barPadding + (barHeight / 2);

                        const succXStart = getXPosition(successorTask.start);
                        const succYCenter = headerHeight + successorTask.index * rowHeight + barPadding + (barHeight / 2);

                        // Determinar si la línea es crítica (une dos tareas críticas)
                        const isCriticalLink = predecessorTask.isCritical && successorTask.isCritical;
                        const linkColor = isCriticalLink ? '#991b1b' : '#6b7280'; // Rojo oscuro si es crítica, gris si no

                        const offset = 8; // Espacio para el codo de la línea

                        // Dibujar una conexión Finish-to-Start
                        // Si la sucesora está arriba, el codo va hacia arriba. Si está abajo, va hacia abajo.
                        const path = `M ${depXEnd} ${depYCenter} 
                                   H ${succXStart > depXEnd ? depXEnd + offset : succXStart - offset} 
                                   V ${succYCenter} 
                                   H ${succXStart}`;

                        lines.push(
                            <path
                                key={`${depId}-${task.id}`}
                                d={path}
                                stroke={linkColor}
                                strokeWidth="2"
                                fill="none"
                                markerEnd={`url(#arrowhead-${isCriticalLink ? 'critical' : 'normal'})`}
                                style={{ pointerEvents: 'none' }}
                            >
                                <title>{`${predecessorTask.name} -> ${successorTask.name} (FS)`}</title>
                            </path>
                        );
                    }
                });
            }
        });

        return lines;
    }, [tasks, taskMap, getXPosition, scaleFactor, headerHeight, rowHeight, barPadding, barHeight]);

    const svgHeight = headerHeight + tasks.length * rowHeight;

    return (
        <div ref={scrollRef} onScroll={onScroll} style={{ width: '100%', height: '100%', overflow: 'auto', backgroundColor: 'white' }}>
            <svg width={svgWidth} height={svgHeight}>
                {/* Definición de la flecha (Marker) */}
                <defs>
                    {/* Flecha normal (gris) */}
                    <marker id="arrowhead-normal" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="10 3.5, 0 0, 0 7" fill="#6b7280" />
                    </marker>
                    {/* Flecha crítica (rojo oscuro) */}
                    <marker id="arrowhead-critical" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="10 3.5, 0 0, 0 7" fill="#991b1b" />
                    </marker>
                </defs>

                {/* Cuadrícula y Cabecera */}
                <g className="header">
                    {timeAxis.map((day, index) => (
                        <g key={index}>
                            {/* Líneas de la cuadrícula vertical */}
                            <line
                                x1={day.x} y1={headerHeight} x2={day.x} y2={svgHeight}
                                stroke="#f3f4f6" strokeWidth="1"
                            />
                            {/* Línea de Hoy */}
                            {day.date.toDateString() === today.toDateString() && (
                                <line x1={day.x} y1={headerHeight} x2={day.x} y2={svgHeight} stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
                            )}
                        </g>
                    ))}

                    {timeAxis.filter(d => d.monthName).map(month => (
                        <text
                            key={`m-${month.x}`}
                            x={month.x + 5}
                            y={headerHeight / 2}
                            style={{ fontSize: '0.75rem', fontWeight: '600', fill: '#4b5563' }}
                        >
                            {month.monthName}
                        </text>
                    ))}

                    <line x1="0" y1={headerHeight} x2={svgWidth} y2={headerHeight} stroke="#d1d5db" strokeWidth="1" />
                </g>

                {/* Líneas de Dependencia */}
                <g className="dependency-lines">
                    {dependencyLines}
                </g>

                {/* Barras de Tareas */}
                <g className="task-bars">
                    {taskBars}
                </g>
            </svg>
        </div>
    );
};

// --- DEFINICIÓN DE COLUMNAS (Añadimos 'Float') ---
const defaultColumnsDef = [
    { id: 'id', header: 'ID', defaultSize: 60, accessorKey: 'id' },
    { id: 'name', header: 'Nombre de Tarea', defaultSize: 200, accessorKey: 'name' },
    { id: 'dependencies', header: 'Predecesores', defaultSize: 100, accessorKey: 'dependencies' },
    { id: 'Float', header: 'Holgura (días)', defaultSize: 100, accessorKey: 'Float' }, // NUEVA COLUMNA CPM
    { id: 'cost', header: 'Costo (USD)', defaultSize: 100, accessorKey: 'cost' },
    { id: 'progress', header: 'Progreso (%)', defaultSize: 100, accessorKey: 'progress' },
    { id: 'priority', header: 'Prioridad', defaultSize: 100, accessorKey: 'priority' },
    { id: 'start', header: 'Inicio (ES)', defaultSize: 120, accessorKey: 'start' },
    { id: 'end', header: 'Fin (EF)', defaultSize: 120, accessorKey: 'end' },
];

// --- COMPONENTE PRINCIPAL ---
const ProjectGanttApp = () => {
    const [leftPanelWidth, setLeftPanelWidth] = useState(55);
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef(null);

    const [tasks, setTasks] = useState(initialTasks);
    const [viewMode, setViewMode] = useState(ViewMode.Month);
    const [collapsedParents, setCollapsedParents] = useState({});
    const [selectedParentToToggle, setSelectedParentToToggle] = useState('');
    const [newColumnName, setNewColumnName] = useState('');
    const [dynamicColumns, setDynamicColumns] = useState([]);
    const [columnWidths, setColumnWidths] = useState(
        defaultColumnsDef.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultSize }), {})
    );

    // Cálculo de la Ruta Crítica
    const { fullTaskData: tasksWithCpm, criticalTasks } = useCriticalPathData(tasks);

    // Referencias de Scroll
    const tableScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);

    // --- FUNCIONES CORE ---
    const generateUniqueId = (prefix = 'T') => `${prefix}${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`;

    const addNewTask = useCallback((parentId = null) => {
        const prefix = parentId ? 'S' : 'T';
        const newId = generateUniqueId(prefix);
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = addDays(today, 1);

        const newTask = {
            id: newId,
            name: parentId ? 'Nueva Subtarea' : 'Nueva Tarea Principal',
            start: today,
            end: tomorrow,
            progress: 0,
            parentId: parentId,
            cost: 0,
            priority: 'Media',
            dependencies: '',
        };

        setTasks(prevTasks => {
            if (parentId) {
                const parentIndex = prevTasks.findIndex(t => t.id === parentId);
                if (parentIndex !== -1) {
                    return [
                        ...prevTasks.slice(0, parentIndex + 1),
                        newTask,
                        ...prevTasks.slice(parentIndex + 1)
                    ];
                }
            }
            return [...prevTasks, newTask];
        });
    }, []);

    const addNewMilestone = useCallback((parentId) => {
        const newId = generateUniqueId('M');
        const today = new Date().toISOString().split('T')[0];

        const newMilestone = {
            id: newId,
            name: 'Nuevo Hito',
            start: today,
            end: today,
            progress: 0,
            parentId: parentId,
            cost: 0,
            priority: 'Alta',
            dependencies: '',
        };

        setTasks(prevTasks => {
            const parentIndex = prevTasks.findIndex(t => t.id === parentId);
            if (parentIndex !== -1) {
                return [
                    ...prevTasks.slice(0, parentIndex + 1),
                    newMilestone,
                    ...prevTasks.slice(parentIndex + 1)
                ];
            }
            return [...prevTasks, newMilestone];
        });
    }, []);

    const columns = useMemo(() => [
        ...defaultColumnsDef,
        ...dynamicColumns.map(col => ({
            id: col.accessorKey,
            header: col.header,
            defaultSize: 120,
            accessorKey: col.accessorKey,
        }))
    ], [dynamicColumns]);

    // Usamos el set de IDs de las tareas ENRIQUECIDAS con CPM
    const parentIds = useMemo(() => new Set(tasksWithCpm.map(t => t.parentId).filter(Boolean)), [tasksWithCpm]);

    const parentTasksOptions = useMemo(() => {
        const rootTasks = tasksWithCpm.filter(t => !t.parentId);
        return [
            { id: '', name: 'Mostrar Todo (Expandir)' },
            ...rootTasks.map(t => ({ id: t.id, name: t.name }))
        ];
    }, [tasksWithCpm]);

    const visibleTasks = useMemo(() => {
        if (tasksWithCpm.length === 0) return [];
        return tasksWithCpm.filter(task => !isTaskHidden(task, collapsedParents, tasksWithCpm));
    }, [tasksWithCpm, collapsedParents]);
    
    // Función central para propagar los cambios de fecha de las subtareas al padre
    const rollupParentDates = useCallback((parentId, currentTasks) => {
        if (!parentId) return currentTasks;

        const children = currentTasks.filter(t => t.parentId === parentId);
        if (children.length === 0) return currentTasks;

        let minStart = null;
        let maxEnd = null;

        children.forEach(child => {
            minStart = minDate(minStart, child.start);
            maxEnd = maxDate(maxEnd, child.end);
        });

        // Buscar el padre y actualizar si es necesario
        return currentTasks.map(task => {
            if (task.id === parentId) {
                let updatedTask = { ...task };
                let changed = false;

                // Solo actualiza si los nuevos límites son diferentes y válidos
                if (minStart && task.start !== minStart) {
                    updatedTask.start = minStart;
                    changed = true;
                }
                if (maxEnd && task.end !== maxEnd) {
                    updatedTask.end = maxEnd;
                    changed = true;
                }

                if (changed) {
                    // Si la tarea padre cambió, recursivamente hacemos rollup a su propio padre (si existe).
                    if (updatedTask.parentId) {
                        return rollupParentDates(updatedTask.parentId, currentTasks.map(t => (t.id === parentId ? updatedTask : t))).find(t => t.id === parentId) || updatedTask;
                    }
                }
                return updatedTask;
            }
            return task;
        });

    }, []);


    // Función para actualizar una tarea, enfocada en los datos base (no CPM)
    const updateTaskData = useCallback((id, columnId, newValue) => {
        setTasks(prevTasks => {
            let updatedTasks = prevTasks.map(task => {
                if (task.id === id) {
                    let updatedValue = newValue;
                    if (columnId === 'cost' || columnId === 'progress') {
                        updatedValue = parseFloat(String(newValue).replace(/[^0-9.]/g, ''));
                        if (isNaN(updatedValue)) updatedValue = 0;
                        if (columnId === 'progress') updatedValue = Math.min(100, Math.max(0, updatedValue));
                    }
                    if ((columnId === 'start' || columnId === 'end') && (!updatedValue || String(updatedValue).trim() === '')) {
                         updatedValue = new Date().toISOString().split('T')[0];
                    }

                    // Lógica especial para hitos (si la tarea en sí es un hito)
                    let updatedTask = { ...task };
                    if (updatedTask.start === updatedTask.end && (columnId === 'start' || columnId === 'end')) {
                        updatedTask.start = updatedValue;
                        updatedTask.end = updatedValue;
                    } else {
                        updatedTask[columnId] = updatedValue;
                    }

                    return updatedTask;
                }
                return task;
            });

            // Si la tarea modificada tiene un padre Y se modificó una fecha, ejecuta el rollup de fechas.
            const modifiedTask = updatedTasks.find(t => t.id === id);
            if (modifiedTask && modifiedTask.parentId && (columnId === 'start' || columnId === 'end')) {
                // Ejecuta el rollup recursivo
                updatedTasks = rollupParentDates(modifiedTask.parentId, updatedTasks);
            }

            return updatedTasks;
        });
    }, [rollupParentDates]);

    const toggleCollapse = useCallback((taskId) => {
        setCollapsedParents(prev => ({
            ...prev,
            [taskId]: !prev[taskId],
        }));
        setSelectedParentToToggle('');
    }, []);

    const handleParentToggle = (e) => {
        const taskId = e.target.value;
        setSelectedParentToToggle(taskId);

        if (taskId === '') {
            setCollapsedParents({});
        } else {
            const newCollapsed = {};
            tasksWithCpm.forEach(task => {
                if (!task.parentId && task.id !== taskId) {
                    newCollapsed[task.id] = true;
                }
            });

            let taskToExpand = tasksWithCpm.find(t => t.id === taskId);
            while (taskToExpand) {
                newCollapsed[taskToExpand.id] = false;
                taskToExpand = tasksWithCpm.find(t => t.id === taskToExpand.parentId);
            }

            setCollapsedParents(newCollapsed);
        }
    };

    const handleAddColumn = () => {
        if (!newColumnName.trim()) return;
        const header = newColumnName.trim();
        const accessorKey = header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

        if (columns.some(col => col.accessorKey === accessorKey || col.id === accessorKey)) {
            console.error('La columna ya existe.');
            setNewColumnName('');
            return;
        }

        const newCol = {
            header: header,
            accessorKey: accessorKey,
        };
        setDynamicColumns(prev => [...prev, newCol]);

        setTasks(prevTasks => prevTasks.map(task => ({
            ...task,
            [accessorKey]: '',
        })));

        setColumnWidths(prev => ({ ...prev, [accessorKey]: 120 }));

        setNewColumnName('');
    };

    const totalTableWidth = useMemo(() => {
        return columns.reduce((sum, col) => sum + (columnWidths[col.id] || col.defaultSize), 0) + 10;
    }, [columns, columnWidths]);

    const startResize = useCallback((e) => {
        setIsResizing(true);
        e.preventDefault();
    }, []);

    const stopResize = useCallback(() => {
        setIsResizing(false);
    }, []);

    const onResize = useCallback((e) => {
        if (!isResizing || !containerRef.current) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const containerBounds = containerRef.current.getBoundingClientRect();
        const newWidthPx = clientX - containerBounds.left;
        const newWidthPercent = (newWidthPx / containerBounds.width) * 100;

        if (newWidthPercent > 15 && newWidthPercent < 85) {
            setLeftPanelWidth(newWidthPercent);
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', onResize);
            window.addEventListener('mouseup', stopResize);
            window.addEventListener('touchmove', onResize);
            window.addEventListener('touchend', stopResize);
        }
        return () => {
            window.removeEventListener('mousemove', onResize);
            window.removeEventListener('mouseup', stopResize);
            window.removeEventListener('touchmove', onResize);
            window.removeEventListener('touchend', stopResize);
        };
    }, [isResizing, onResize, stopResize]);

    const handleScroll = (scrollingElement, targetRef) => {
        if (targetRef.current && scrollingElement !== targetRef.current) {
            targetRef.current.scrollTop = scrollingElement.scrollTop;
        }
    };

    const onTableScroll = (e) => handleScroll(e.currentTarget, ganttScrollRef);
    const onGanttScroll = (e) => handleScroll(e.currentTarget, tableScrollRef);

    // --- ESTILOS EN LÍNEA ---
    const mainAppStyle = {
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '1rem',
        fontFamily: 'Inter, sans-serif',
    };

    const headerStyle = {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#4f46e5',
        marginBottom: '1rem',
    };

    const controlsContainerStyle = {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
        border: '1px solid #f3f4f6',
    };

    const selectLabelStyle = {
        fontWeight: '600',
        fontSize: '0.875rem',
        color: '#4b5563',
        marginRight: '0.5rem',
    };

    const selectStyle = {
        paddingTop: '0.25rem',
        paddingBottom: '0.25rem',
        paddingLeft: '0.75rem',
        paddingRight: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        outline: 'none',
        transition: 'all 0.15s ease-in-out',
        backgroundColor: 'white',
    };

    const columnInputGroupStyle = {
        display: 'flex',
        columnGap: '0.5rem',
    };

    const columnInputStyle = {
        paddingTop: '0.25rem',
        paddingBottom: '0.25rem',
        paddingLeft: '0.75rem',
        paddingRight: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        outline: 'none',
    };

    const addButtonStyle = (disabled) => ({
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingTop: '0.375rem',
        paddingBottom: '0.375rem',
        borderRadius: '0.5rem',
        color: 'white',
        fontWeight: '500',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.15s ease-in-out',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: disabled ? '#9ca3af' : '#10b981',
        cursor: disabled ? 'not-allowed' : 'pointer',
    });


    // --- Estilos Finales (del fragmento 3) ---
    const splitContainerStyle = {
        display: 'flex',
        flexDirection: 'row',
        height: 'calc(100vh - 120px)',
        width: '100%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        margin: '0 auto',
        backgroundColor: 'white',
        minHeight: '400px',
    };

    const tableContainerStyle = {
        width: '100%',
        height: '100%',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
    };

    const tableStyle = {
        width: totalTableWidth,
        minWidth: '100%',
        borderCollapse: 'collapse',
    };

    const tableHeaderRowStyle = {
        backgroundColor: '#f3f4f6',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        height: '40px'
    };

    const tableHeaderCellStyle = (columnId) => ({
        width: columnWidths[columnId] || defaultColumnsDef.find(c => c.id === columnId)?.defaultSize || 120,
        border: '1px solid #d1d5db',
        padding: '0.5rem',
        textAlign: 'left',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#4b5563',
        textTransform: 'uppercase',
        position: 'relative',
        minWidth: '60px',
    });

    const tableRowStyle = {
        transition: 'background-color 0.1s ease-in-out',
        height: `${ROW_HEIGHT_PX}px`
    };

    const tableCellWrapperStyle = (columnId) => ({
        padding: 0,
        border: '1px solid #d1d5db',
        verticalAlign: 'top',
        width: columnWidths[columnId] || defaultColumnsDef.find(c => c.id === columnId)?.defaultSize || 120,
        height: `${ROW_HEIGHT_PX}px`,
        backgroundColor: 'white',
    });


    return (
        <div style={mainAppStyle}>
            <h1 style={headerStyle}>Gestor de Proyectos (Ruta Crítica Implementada)</h1>

            <div style={controlsContainerStyle}>
                {/* Indicador de Ruta Crítica */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#4b5563' }}>
                    <div style={{ width: '16px', height: '16px', backgroundColor: '#ef4444', borderRadius: '4px', marginRight: '0.5rem' }}></div>
                    Ruta Crítica ({criticalTasks.length} tareas)
                </div>

                {/* Selector de Zoom */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={selectLabelStyle}>Zoom:</label>
                    <select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                        style={selectStyle}
                    >
                        <option value={ViewMode.Day}>Día</option>
                        <option value={ViewMode.Week}>Semana</option>
                        <option value={ViewMode.Month}>Mes</option>
                        <option value={ViewMode.Year}>Año</option>
                    </select>
                </div>

                {/* PICKER DE COLAPSADO/FILTRO */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={selectLabelStyle}>Filtrar por Tarea Principal:</label>
                    <select
                        value={selectedParentToToggle}
                        onChange={handleParentToggle}
                        style={selectStyle}
                    >
                        {parentTasksOptions.map(option => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Entrada para Agregar Columnas */}
                <div style={columnInputGroupStyle}>
                    <input
                        type="text"
                        placeholder="Nueva Columna"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        style={columnInputStyle}
                    />
                    <button
                        onClick={handleAddColumn}
                        disabled={!newColumnName.trim()}
                        style={addButtonStyle(!newColumnName.trim())}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '1rem', width: '1rem', display: 'inline-block', marginRight: '0.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Columna
                    </button>
                </div>

                {/* Botón para Agregar fila principal */}
                <div style={columnInputGroupStyle}>
                    <button
                        onClick={() => addNewTask(null)}
                        style={addButtonStyle(false)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '1rem', width: '1rem', display: 'inline-block', marginRight: '0.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Nueva Tarea
                    </button>
                </div>
            </div>

            <div className="contenedor-split" ref={containerRef}
                style={splitContainerStyle}>

                {/* PANEL IZQUIERDO: TABLA DE TAREAS */}
                <div
                    style={{ width: `${leftPanelWidth}%`, flexShrink: 0 }}
                >
                    <div
                        ref={tableScrollRef}
                        style={tableContainerStyle}
                        onScroll={onTableScroll}
                    >
                        <table
                            style={tableStyle}
                        >
                            <thead>
                                <tr style={tableHeaderRowStyle}>
                                    {columns.map(column => (
                                        <th
                                            key={column.id}
                                            style={tableHeaderCellStyle(column.id)}
                                        >
                                            {column.header}

                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    top: 0,
                                                    height: '100%',
                                                    width: '8px',
                                                    cursor: 'col-resize',
                                                    opacity: 0.1,
                                                    backgroundColor: '#4f46e5',
                                                    transition: 'opacity 0.15s',
                                                }}
                                            />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Renderiza solo las filas de tareas visibles */}
                                {visibleTasks.map(task => (
                                    <tr
                                        key={task.id}
                                        style={tableRowStyle}
                                    >
                                        {columns.map(column => (
                                            <td
                                                key={`${task.id}-${column.id}`}
                                                style={tableCellWrapperStyle(column.accessorKey)}
                                            >
                                                <EditableCell
                                                    task={task}
                                                    columnId={column.accessorKey}
                                                    // Usamos los datos enriquecidos con CPM aquí
                                                    value={task[column.accessorKey] ?? (column.accessorKey === 'cost' || column.accessorKey === 'progress' ? 0 : '')}
                                                    updateTaskData={updateTaskData}
                                                    allTasks={tasksWithCpm}
                                                    parentIds={parentIds}
                                                    collapsedParents={collapsedParents}
                                                    toggleCollapse={toggleCollapse}
                                                    addNewTask={addNewTask}
                                                    addNewMilestone={addNewMilestone}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SPLITTER (DIVISOR) */}
                <div
                    onMouseDown={startResize}
                    onTouchStart={startResize}
                    style={{
                        width: '8px',
                        backgroundColor: isResizing ? '#4f46e5' : '#ccc',
                        cursor: 'col-resize',
                        flexShrink: 0,
                        transition: 'background-color 0.2s',
                        zIndex: 10,
                    }}
                />


                {/* PANEL DERECHO: VISTA GANTT */}
                <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                    <CustomGantt
                        tasks={visibleTasks}
                        viewMode={viewMode}
                        scrollRef={ganttScrollRef}
                        onScroll={onGanttScroll}
                    />
                </div>
            </div>
        </div>
    );
};

export default ProjectGanttApp;