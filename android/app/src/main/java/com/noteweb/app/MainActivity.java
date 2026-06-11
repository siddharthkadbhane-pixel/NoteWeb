package com.noteweb.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom NoteWebHelper plugin
        registerPlugin(NoteWebHelperPlugin.class);
        
        // Schedule periodic background sync
        scheduleBackgroundSync(this);
    }

    public static void scheduleBackgroundSync(Context context) {
        Intent intent = new Intent(context, BackgroundSyncReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            9876,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            long interval = 15 * 60 * 1000; // 15 minutes
            long triggerAt = System.currentTimeMillis() + 60 * 1000; // start in 1 minute
            alarmManager.setInexactRepeating(
                AlarmManager.RTC_WAKEUP,
                triggerAt,
                interval,
                pendingIntent
            );
        }
    }
}
