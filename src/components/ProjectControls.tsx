// src/components/ProjectControls.tsx
import React from 'react';
import { ViewModeType, ViewMode } from '../constants';

interface ProjectControlsProps {
    criticalTasks: string[];
    viewMode: ViewModeType;
    setViewMode: (mode: ViewModeType) => void;
    addNewTask: (parentId: string | null) => void;
    addDynamicColumn: () => void;
}

const ProjectControls: React.FC<ProjectControlsProps> = ({ criticalTasks, viewMode, setViewMode, addNewTask, addDynamicColumn }) => {
    
    // --- ESTILOS INLINE Y INLINE-BLOCK ---
    const controlsContainerStyle: React.CSSProperties = { 
        marginBottom: '15px', 
        borderBottom: '1px solid #D1D5DB',
        paddingBottom: '10px',
        backgroundColor: '#1F2937', // Fondo negro (Dark Gray)
        padding: '10px 15px',
        borderRadius: '5px'
    };
    const controlItemStyle: React.CSSProperties = {
        display: 'inline-block',
        marginRight: '15px',
        verticalAlign: 'middle',
    };
    const buttonStyle: React.CSSProperties = { 
        padding: '8px 15px', 
        backgroundColor: '#4F46E5', 
        color: 'white', 
        border: 'none', 
        borderRadius: '5px', 
        cursor: 'pointer', 
        fontSize: '14px',
        display: 'inline-block' 
    };
    const secondaryButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        backgroundColor: '#10B981', // Verde
        padding: '8px 10px',
        marginRight: '15px'
    };
    const criticalPathStyle: React.CSSProperties = {
        ...controlItemStyle, 
        color: '#F9FAFB', // Texto blanco
        margin: 0,
        fontWeight: 'bold'
    };
    const criticalTasksStyle: React.CSSProperties = {
        color: '#DC2626', // Rojo para la ruta crítica
        fontWeight: 'bold'
    };
    const viewModeControlsStyle: React.CSSProperties = {
        marginLeft: 'auto', 
        display: 'inline-block',
        float: 'right', 
        paddingTop: '3px'
    };


    return (
        <div style={controlsContainerStyle}>
            
            {/* Botón para Tarea Principal */}
            <div style={controlItemStyle}>
                <button onClick={() => addNewTask(null)} style={buttonStyle}>+ Tarea Principal</button>
            </div>

            {/* Botón para Añadir Columna Dinámica */}
            <div style={controlItemStyle}>
                <button onClick={addDynamicColumn} style={secondaryButtonStyle}>+ Columna</button>
            </div>
            
            <p style={criticalPathStyle}>
                Ruta Crítica: <span style={criticalTasksStyle}>{criticalTasks.join(', ') || 'Calculando...'}</span>
            </p>

            <div style={viewModeControlsStyle}>
                {/* Selectores de Zoom/ViewMode */}
                {(Object.keys(ViewMode) as ViewModeType[]).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        style={{
                            ...buttonStyle,
                            backgroundColor: viewMode === mode ? '#1E40AF' : '#6366F1',
                            padding: '6px 12px',
                            fontSize: '12px',
                            marginRight: '5px'
                        }}
                    >
                        {mode}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ProjectControls;