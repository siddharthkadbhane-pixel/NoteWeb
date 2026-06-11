package com.noteweb.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NoteWebHelper")
public class NoteWebHelperPlugin extends Plugin {
    @PluginMethod
    public void saveUserUid(PluginCall call) {
        String uid = call.getString("uid");
        if (uid != null) {
            SharedPreferences sharedPref = getContext().getSharedPreferences("NoteWebPrefs", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = sharedPref.edit();
            editor.putString("user_uid", uid);
            editor.apply();
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("UID is null");
        }
    }

    @PluginMethod
    public void clearUserUid(PluginCall call) {
        SharedPreferences sharedPref = getContext().getSharedPreferences("NoteWebPrefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = sharedPref.edit();
        editor.remove("user_uid");
        editor.remove("last_notified_msg_id");
        editor.apply();
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
