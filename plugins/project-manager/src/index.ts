import { Plugin } from '@vibe-ctl/extension-api';
import { ProjectTreeWidget } from './widgets/ProjectTreeWidget';

/**
 * Project Manager plugin.
 *
 * Renderer-only. Provides the `projects` service and a project-tree
 * widget. Consumes the optional `claude-code` service to hydrate the
 * tree; works (empty) if claude-code is disabled.
 */
export default class ProjectManagerPlugin extends Plugin {
  async onActivate(): Promise<void> {
    // TODO: const cc = this.ctx.services.optional('claude-code');
    // TODO: this.ctx.services.provide('projects', facade);

    this.ctx.widgets.register({
      type: 'project-tree',
      component: ProjectTreeWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['side-panel:left', 'canvas'],
      defaultSize: { width: 280, height: 560 },
    });
  }
}
