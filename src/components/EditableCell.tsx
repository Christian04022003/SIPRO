import React, { useState, useEffect, useRef } from 'react';

// Definiciones de tipos y constantes asumidas
/** @typedef {'Alta' | 'Media' | 'Baja'} PriorityType */
/** @typedef {{ id: string, name: string, isCritical: boolean, totalSlack: number | 'N/A', index: number, priority: PriorityType, cost: number, progress: number, start: string, end: string, isMilestone?: boolean, parentId?: string }} TaskWithCPM */
const ROW_HEIGHT_PX = 32;

// FUNCIÓN DE PROFUNDIDAD (Mantenida)
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
    initialValue: any; 
}

const EditableCell = React.memo(({ initialValue, task, columnId, allTasks, updateTaskData, parentIds, collapsedParents, toggleCollapse, addNewTask, addNewMilestone }) => {

    const safeInitialValue = String(initialValue ?? '');
    const [value, setValue] = useState(safeInitialValue);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);




    // =================================================================
    // LÓGICA DE VALIDACIÓN CORREGIDA
    // =================================================================

    // 1. Determinar si la tarea es PADRE (tiene hijos).
    // Si la ID de la tarea actual (task.id) está en el Set 'parentIds',
    // significa que al menos una subtarea la está usando como su parentId.
    const isParent = parentIds.has(task.id); 








    // 2. Definir si el campo es CALCULADO (Solo lectura).
    // Esto es TRUE solo si: (es un padre) AND (el campo es 'start', 'end', 'progress', o 'cost').
    const isCalculatedField = isParent && (
        columnId === 'start' || 
        columnId === 'end' || 
        columnId === 'progress' || 
        columnId === 'cost'
    );

    // Sincroniza el estado local con el valor de la tarea
    useEffect(() => { setValue(safeInitialValue); }, [safeInitialValue]);

    const onBlur = () => {
        setIsEditing(false);
        // Bloqueo: No actualizar si es un campo calculado.
        if (!isCalculatedField && String(value) !== String(initialValue)) {
            updateTaskData(task.id, columnId, value);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { onBlur(); }
        else if (e.key === 'Escape') { setValue(safeInitialValue); setIsEditing(false); }
    };

    const handleDoubleClick = () => {
        // Bloqueo: No entrar en modo edición si es un campo calculado.
        if (isCalculatedField) {
            return;
        }
        
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    /** @type {PriorityType[]} */
    const priorityOptions = ['Alta', 'Media', 'Baja'];

    // Estilos de la celda
    const defaultCellStyle = {
        height: `${ROW_HEIGHT_PX}px`,
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: '14px',
        // Estilo de cursor para indicar bloqueo
        cursor: isCalculatedField ? 'not-allowed' : 'default',
        fontWeight: 'normal', 
        color: 'inherit',
    };

    // Estilo visual para campos de solo lectura
    const calculatedStyle = {
        backgroundColor: '#F3F4F6', // Fondo gris
        fontStyle: 'italic',
        color: '#6B7280', // Color de texto gris oscuro
        fontWeight: 'normal',
    };

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
            fontWeight: 'normal', 
            color: '#1F2937', 
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

            </div>
        );
    }

    // Renderizado y formateo de celdas normales (omitiendo por brevedad)
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
        const slackValue = task.totalSlack ?? 'N/A';
        const floatColor = slackValue === 0 ? '#DC2626' : '#10B981'; 
        formattedValue = <span style={{ color: floatColor, fontWeight: 'bold' }}>{slackValue === 'N/A' ? slackValue : `${slackValue} días`}</span>;
    }
    
    // Si es un campo calculado (Padre y campo de resumen), aplica el estilo de solo lectura
    if (isCalculatedField) {
        return (
            <div style={{ ...defaultCellStyle, ...calculatedStyle }}>
                {formattedValue || <span dangerouslySetInnerHTML={{ __html: '&nbsp;' }} />}
            </div>
        );
    }


    // Si NO es un campo calculado, permite la edición
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
                    type={columnId === 'cost' || columnId === 'progress' ? 'number' : columnId === 'start' || columnId === 'end' ? 'date' : 'text'}
                />
            ) : (
                formattedValue || (formattedValue === 0 ? '0' : <span dangerouslySetInnerHTML={{ __html: '&nbsp;' }} />)
            )}
        </div>
    );
});

export default EditableCell;