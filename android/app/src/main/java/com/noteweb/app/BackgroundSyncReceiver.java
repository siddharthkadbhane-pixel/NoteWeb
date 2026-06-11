package com.noteweb.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

public class BackgroundSyncReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "NoteWebChannel";
    private static final String PREFS_NAME = "NoteWebPrefs";
    private static final String SUPABASE_URL = "https://uyqegcuithhbnvviujbv.supabase.co";
    private static final String SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5cWVnY3VpdGhoYm52dml1amJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzA4NTIsImV4cCI6MjA5NDk0Njg1Mn0.BZSRDkbB9DyXo53xpYajPMUcG3GeYYwEes1mI5_vQCs";

    @Override
    public void onReceive(Context context, Intent intent) {
        new Thread(() -> {
            try {
                checkNewMessages(context);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void checkNewMessages(Context context) throws Exception {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String userUid = prefs.getString("user_uid", "");
        
        if (userUid.isEmpty()) {
            return;
        }

        // Query Supabase direct_messages table for unread DMs destined for this user
        String urlString = SUPABASE_URL + "/rest/v1/direct_messages?recipient_id=eq." + userUid + "&is_read=eq.false&order=created_at.desc&limit=5";
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("apikey", SUPABASE_KEY);
        conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);

        int responseCode = conn.getResponseCode();
        if (responseCode == 200) {
            BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder response = new StringBuilder();
            String inputLine;
            while ((inputLine = in.readLine()) != null) {
                response.append(inputLine);
            }
            in.close();

            JSONArray messages = new JSONArray(response.toString());
            if (messages.length() > 0) {
                JSONObject latestMsg = messages.getJSONObject(0);
                String msgId = latestMsg.optString("id");
                String messageText = latestMsg.optString("message", "Sent you a message");
                String senderId = latestMsg.optString("sender_id");

                String lastNotifiedId = prefs.getString("last_notified_msg_id", "");
                if (!msgId.equals(lastNotifiedId)) {
                    prefs.edit().putString("last_notified_msg_id", msgId).apply();

                    // Resolve sender's displayName / username
                    String senderName = fetchSenderName(senderId);

                    // Show notification
                    showNotification(context, senderName, messageText, senderId);
                }
            }
        }
        conn.disconnect();
    }

    private String fetchSenderName(String senderId) {
        try {
            String urlString = SUPABASE_URL + "/rest/v1/profiles?id=eq." + senderId + "&select=display_name,username";
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("apikey", SUPABASE_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            if (conn.getResponseCode() == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();
                
                JSONArray profiles = new JSONArray(response.toString());
                if (profiles.length() > 0) {
                    JSONObject profile = profiles.getJSONObject(0);
                    String displayName = profile.optString("display_name");
                    if (displayName != null && !displayName.isEmpty()) {
                        return displayName;
                    }
                    return profile.optString("username", "Classmate");
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return "Classmate";
    }

    private void showNotification(Context context, String senderName, String messageText, String senderId) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "NoteWeb Chats",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            notificationManager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("dm_sender_id", senderId);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("✉️ DM from " + senderName)
            .setContentText(messageText)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
    }
}
