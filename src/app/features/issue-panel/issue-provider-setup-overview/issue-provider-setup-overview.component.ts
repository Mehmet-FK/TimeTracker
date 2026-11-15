import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { T } from '../../../t.const';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { IssueProviderKey, isValidIssueProviderKey } from '../../issue/issue.model';
import { DialogEditIssueProviderComponent } from '../../issue/dialog-edit-issue-provider/dialog-edit-issue-provider.component';
import { Store } from '@ngrx/store';
import { MatDialog } from '@angular/material/dialog';
import { selectEnabledIssueProviders } from '../../issue/store/issue-provider.selectors';
import { PluginIssueProviderRegistryService } from '../../../plugins/issue-provider/plugin-issue-provider-registry.service';
import { PluginService } from '../../../plugins/plugin.service';
import { IssueLog } from '../../../core/log';

@Component({
  selector: 'issue-provider-setup-overview',
  imports: [MatIcon, TranslateModule],
  templateUrl: './issue-provider-setup-overview.component.html',
  styleUrl: './issue-provider-setup-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueProviderSetupOverviewComponent {
  protected readonly T = T;
  private _store = inject(Store);
  private _matDialog = inject(MatDialog);
  private _pluginRegistry = inject(PluginIssueProviderRegistryService);
  private _pluginService = inject(PluginService);

  enabledProviders$ = this._store.select(selectEnabledIssueProviders);
  // NOTE: intentionally non-reactive for v1 — plugins load at startup before this dialog opens
  pluginProviders = this._pluginRegistry.getAvailableProviders();
  disabledPluginProviders = this._pluginService.getDisabledIssueProviderPlugins();

  openSetupDialog(issueProviderKey: IssueProviderKey): void {
    this._matDialog.open(DialogEditIssueProviderComponent, {
      restoreFocus: true,
      data: {
        issueProviderKey,
      },
    });
  }

  async enablePluginAndOpenSetup(
    pluginId: string,
    issueProviderKey: string,
  ): Promise<void> {
    await this._pluginService.enableAndActivatePlugin(pluginId);
    // Remove from disabled list and refresh enabled list
    this.disabledPluginProviders = this.disabledPluginProviders.filter(
      (p) => p.pluginId !== pluginId,
    );
    this.pluginProviders = this._pluginRegistry.getAvailableProviders();
    if (!isValidIssueProviderKey(issueProviderKey)) {
      IssueLog.err(`Invalid issue provider key from plugin: "${issueProviderKey}"`);
      return;
    }
    this.openSetupDialog(issueProviderKey);
  }
}
