import { check } from '@tauri-apps/plugin-updater';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { dataManager } from './dataManager';
import { toast } from 'sonner';

export async function checkForUpdates(onStart: boolean = false) {
  try {
    const update = await check();

    if (update) {
      const autoUpdate = (await dataManager.getSetting('auto_update')) === 'true';

      if (autoUpdate) {
        toast.info(`Downloading update v${update.version}...`, { duration: 5000 });

        let downloaded = 0;
        let contentLength: number | undefined = 0;

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength;
              console.log(`started downloading ${event.data.contentLength} bytes`);
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              console.log(`downloaded ${downloaded} from ${contentLength}`);
              break;
            case 'Finished':
              console.log('download finished');
              break;
          }
        });

        await message('Update installed successfully. The application will now restart.', {
          title: 'Update Complete',
          kind: 'info',
        });

        // In Tauri v2, the app typically restarts automatically after downloadAndInstall if it's a msi/exe on windows
        // or we might need to trigger it. The plugin usually handles the relaunch.
      } else {
        const yes = await ask(
          `A new version (v${update.version}) is available. Would you like to download and install it now?\n\nRelease notes: ${update.body || 'No release notes available.'}`,
          {
            title: 'Update Available',
            kind: 'info',
            okLabel: 'Update Now',
            cancelLabel: 'Later',
          }
        );

        if (yes) {
          toast.info(`Downloading update v${update.version}...`);
          await update.downloadAndInstall();
          await message('Update installed successfully. The application will now restart.', {
            title: 'Update Complete',
            kind: 'info',
          });
        }
      }
    } else if (!onStart) {
      toast.success('You are running the latest version.');
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
    if (!onStart) {
      toast.error('Failed to check for updates. Please try again later.');
    }
  }
}
