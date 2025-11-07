import React, { useState, useEffect, useRef } from 'react';

// Definiciones de tipos y constantes asumidas
/** @typedef {'Alta' | 'Media' | 'Baja'} PriorityType */
/** @typedef {{ id: string, name: string, isCritical: boolean, totalSlack: number | 'N/A', index: number, priority: PriorityType, cost: number, progress: number, start: string, end: string, isMilestone?: boolean, parentId?: string }} TaskWithCPM */
const ROW_HEIGHT_PX = 32;

// Campos que se CALCULAN automáticamente a partir de los hijos.
// Estos campos SÓLO se bloquean en las tareas que son padres.
const CALCULATED_FIELDS = ['start', 'end', 'progress', 'cost'];


// ----------------------------------------------------------------
// FUNCIÓN DE PROFUNDIDAD (Mantenida)
// ----------------------------------------------------------------
/**
 * Calcula el nivel de profundidad de una tarea.
 * @param {TaskWithCPM} task - La tarea actual.
 * @param {TaskWithCPM[]} allTasks - La lista completa de tareas.
 * @returns {number} El nivel de profundidad (0 para la raíz).
 */
const getTaskDepth = (task, allTasks) => {
    let depth = 0;
    let currentTask = task;
    const taskMap = allTasks.reduce((map, t) => {
        map[t.id] = t;
        return map;
    }, {});

    while (currentTask?.parentId) {
        currentTask = taskMap[currentTask.parentId];
        if (currentTask) {
            depth++;
        } else {
            break;
        }
    }
    return depth;
};
// ----------------------------------------------------------------


interface EditableCellProps {
    value: any;
    task: TaskWithCPM;
    columnId: string;
    allTasks: TaskWithCPM[];
    updateTaskData: (id: string, columnId: string, newValue: any) => void;
    // parentIds: Un Set<string> que contiene IDs de tareas que tienen al menos un hijo.
    parentIds: Set<string>; 
    collapsedParents: Record<string, boolean>;
    toggleCollapse: (taskId: string) => void;
    addNewTask: (parentId: string | null) => void;
    addNewMilestone: (parentId: string | null) => void;
    // Agregamos initialValue para la coherencia con React.memo
    initialValue: any; 
}

const EditableCell = React.memo(({ initialValue, task, columnId, allTasks, updateTaskData, parentIds, collapsedParents, toggleCollapse, addNewTask, addNewMilestone }) => {

    const safeInitialValue = String(initialValue ?? '');
    const [value, setValue] = useState(safeInitialValue);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    // 1. Determinar si la tarea es padre (tiene hijos).
    // Para una tarea nueva, su ID NO estará en parentIds, por lo que isParent será FALSE.
    const isParent = parentIds.has(task.id);
    console.log(isParent)

    
    // 2. Determinar si este campo debe estar bloqueado (es un campo de resumen).
    // ES BLOQUEADO solo si: 1) es un padre (isParent=true) Y 2) la columna es de resumen.
    // Esto es FALSE para cualquier tarea nueva o tarea hoja.
    const isCalculatedField = isParent && CALCULATED_FIELDS.includes(columnId);

    // Sincroniza el estado local con el valor de la tarea
    useEffect(() => { setValue(safeInitialValue); }, [safeInitialValue]);

    const onBlur = () => {
        setIsEditing(false);
        // CRÍTICO: Solo actualiza si NO es un campo calculado de un padre (si es hoja/nueva, sí se actualiza)
        if (!isCalculatedField && String(value) !== String(initialValue)) {
            updateTaskData(task.id, columnId, value);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { onBlur(); }
        else if (e.key === 'Escape') { setValue(safeInitialValue); setIsEditing(false); }
    };

    const handleDoubleClick = () => {
        // Reglas de no editabilidad para IDs y Campos CPM (SIEMPRE BLOQUEADOS)
        if (columnId === 'id' || columnId === 'totalSlack' || columnId === 'index') {
            return;
        }

        // REGLA CRÍTICA: Bloquear edición solo si el campo es calculado (es decir, es una tarea padre y un campo de resumen).
        // Si es una tarea nueva (isCalculatedField es FALSE), este return NO se ejecuta.
        if (isCalculatedField) {
            return;
        }
        
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    /** @type {PriorityType[]} */
    const priorityOptions = ['Alta', 'Media', 'Baja'];

    // Estilo base de la celda
    const defaultCellStyle = {
        height: `${ROW_HEIGHT_PX}px`,
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: '14px',
        // El cursor indica si está bloqueado o no
        cursor: isCalculatedField ? 'not-allowed' : 'default',
        fontWeight: task.isCritical && columnId !== 'name' ? 'bold' : 'normal',
        color: task.isCritical && columnId !== 'name' && columnId !== 'totalSlack' ? '#DC2626' : 'inherit',
    };

    // Estilo para campos que son calculados (no editables)
    const calculatedStyle = {
        backgroundColor: '#F3F4F6', // Fondo ligeramente gris
        fontStyle: 'italic', // Cursiva
        color: '#6B7280', // Gris oscuro para indicar valor derivado
        fontWeight: 'normal',
    };

    // Lógica para columna 'index' (No editable)
    if (columnId === 'index') {
        return (
            <div style={defaultCellStyle}>
                <span style={{ fontWeight: 'bold', color: '#4B5563' }}>{value}</span>
            </div>
        );
    }

    // Lógica para columna 'priority' (selector, siempre editable)
    if (columnId === 'priority') {
        return (
            <select
                value={task.priority}
                onChange={(e) => updateTaskData(task.id, columnId, e.target.value)}
                style={{ height: '100%', width: '100%', padding: '0 8px', border: 'none', background: 'white', cursor: 'pointer', fontSize: '14px' }}
            >
                {priorityOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        );
    }

    // Lógica para columna 'name' (jerarquía, colapso, botones)
    if (columnId === 'name') {
        const isMilestone = task.isMilestone ?? (task.start === task.end && task.progress === 100);
        const isCollapsed = collapsedParents[task.id];
        const depth = getTaskDepth(task, allTasks);

        const nameCellStyle = {
            ...defaultCellStyle,
            paddingLeft: `${depth * 20 + 8}px`, 
            backgroundColor: isCollapsed ? '#F3F4F6' : 'transparent',
            cursor: 'default',
            fontWeight: task.isCritical ? 'bold' : 'normal',
            color: task.isCritical ? '#DC2626' : '#1F2937',
            justifyContent: 'space-between'
        };

        const toggleIconStyle = {
            fontSize: '10px',
            marginRight: '5px',
            transition: 'transform 0.2s',
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            cursor: 'pointer',
            minWidth: '16px',
            flexShrink: 0
        };

        const buttonStyle = {
            marginLeft: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#4F46E5',
            backgroundColor: 'transparent',
            border: '1px solid #ddd',
            outline: 'none',
            padding: '0 4px',
            borderRadius: '3px',
            zIndex: 10
        };

        const toggleIcon = isParent ? (
            <span onClick={() => toggleCollapse(task.id)} style={toggleIconStyle}> &#9658; </span>
        ) : (
            // Icono invisible para mantener la alineación de las tareas hoja
            <span style={{ minWidth: '16px', fontSize: '10px', flexShrink: 0, visibility: 'hidden', marginRight: '5px' }}>&#9658;</span>
        );

        return (
            <div style={nameCellStyle} onDoubleClick={handleDoubleClick}>
                <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, overflow: 'hidden' }}>
                    {toggleIcon}
                    <div style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isMilestone ? '💎 ' : ''}
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                onBlur={onBlur}
                                onKeyDown={handleKeyDown}
                                style={{ border: '1px solid #9CA3AF', padding: '2px', width: '90%', outline: 'none' }}
                                type="text"
                            />
                        ) : (
                            value
                        )}
                    </div>
                </div>
                {/* Los botones de agregar solo aparecen en las tareas padre */}
                {isParent && !isEditing && (
                    <div style={{ flexShrink: 0 }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                addNewTask(task.id);
                            }}
                            style={buttonStyle}
                            title="Agregar Subtarea"
                        >
                            +
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                addNewMilestone(task.id);
                            }}
                            style={buttonStyle}
                            title="Agregar Sub-Hito"
                        >
                            ◊
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Renderizado y formateo de celdas normales
    let formattedValue = value;
    if (columnId === 'cost') {
        formattedValue = `$${(parseFloat(value) || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } else if (columnId === 'progress') {
        formattedValue = `${parseInt(value, 10) || 0}%`;
    } else if (columnId === 'dependencies') {
        const depString = value.split(',').map((id) => id.trim()).filter((id) => id).join(', ');
        if (depString) {
            formattedValue = <span style={{ color: '#4F46E5', fontWeight: 'bold' }}>{depString}</span>
        } else {
            formattedValue = null;
        }
    } else if (columnId === 'totalSlack') {
        // La celda de Holgura no es editable
        const slackValue = task.totalSlack ?? 'N/A';
        const floatColor = slackValue === 0 ? '#DC2626' : '#10B981';
        formattedValue = <span style={{ color: floatColor, fontWeight: 'bold' }}>{slackValue === 'N/A' ? slackValue : `${slackValue} días`}</span>;
        return <div style={defaultCellStyle}>{formattedValue}</div>;
    }

    // Renderizado de campos calculados (si aplica)
    if (isCalculatedField) {
        return (
            <div style={{ ...defaultCellStyle, ...calculatedStyle }}>
                {/* Muestra el valor formateado o un espacio &nbsp; si está vacío */}
                {formattedValue || <span dangerouslySetInnerHTML={{ __html: '&nbsp;' }} />}
            </div>
        );
    }


    // Renderizado de celdas editables por Doble-Click (tareas hoja o campos no calculados)
    // ESTE BLOQUE SE EJECUTA PARA CUALQUIER TAREA NUEVA/HOJA.
    return (
        <div onDoubleClick={handleDoubleClick} style={defaultCellStyle}>
            {isEditing ? (
                <input
                    ref={inputRef}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onBlur={onBlur}
                    onKeyDown={handleKeyDown}
                    style={{ border: '1px solid #9CA3AF', padding: '2px', width: '90%', outline: 'none' }}
                    // Usar tipo 'number' para costo/progreso, 'date' para fechas.
                    type={columnId === 'cost' || columnId === 'progress' ? 'number' : columnId === 'start' || columnId === 'end' ? 'date' : 'text'}
                />
            ) : (
                // Muestra el valor formateado o un espacio &nbsp; si está vacío
                formattedValue || (formattedValue === 0 ? '0' : <span dangerouslySetInnerHTML={{ __html: '&nbsp;' }} />)
            )}
        </div>
    );
});

export default EditableCell;