/**
 * In-memory workout template store.
 * Templates survive navigation within a session but reset on app restart.
 */

export interface WorkoutTemplate {
  id:          string;
  name:        string;
  exerciseIds: string[];
  muscles:     string[];
  createdAt:   string;
}

let _templates: WorkoutTemplate[] = [];

export function getTemplates(): WorkoutTemplate[] {
  return [..._templates];
}

export function saveTemplate(tpl: Omit<WorkoutTemplate, 'id' | 'createdAt'>): WorkoutTemplate {
  const t: WorkoutTemplate = {
    ...tpl,
    id:        `tpl-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  _templates = [t, ..._templates];
  return t;
}

export function deleteTemplate(id: string): void {
  _templates = _templates.filter(t => t.id !== id);
}

export function renameTemplate(id: string, name: string): void {
  _templates = _templates.map(t => t.id === id ? { ...t, name } : t);
}
