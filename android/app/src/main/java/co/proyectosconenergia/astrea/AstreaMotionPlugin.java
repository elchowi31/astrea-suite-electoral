package co.proyectosconenergia.astrea;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayDeque;

/** Confirma actividad física sin permisos nuevos ni almacenar datos del sensor. */
@CapacitorPlugin(name = "AstreaMotion")
public class AstreaMotionPlugin extends Plugin implements SensorEventListener {
    private SensorManager manager;
    private Sensor sensor;
    private int watchers = 0;
    private boolean available = false;
    private int samples = 0;
    private final float[] gravity = new float[3];
    private final ArrayDeque<Long> activity = new ArrayDeque<>();
    private long lastMotionAt = 0;

    @PluginMethod public synchronized void start(PluginCall call) {
        if (watchers++ == 0) {
            samples = 0; lastMotionAt = 0; activity.clear();
            manager = (SensorManager)getContext().getSystemService(Context.SENSOR_SERVICE);
            sensor = manager == null ? null : manager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
            if (sensor == null && manager != null) sensor = manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            available = sensor != null && manager.registerListener(this, sensor, 100000);
        }
        call.resolve(state());
    }

    @PluginMethod public synchronized void getState(PluginCall call) { call.resolve(state()); }
    @PluginMethod public synchronized void stop(PluginCall call) {
        if (watchers > 0 && --watchers == 0) release();
        call.resolve();
    }
    private JSObject state() {
        JSObject result = new JSObject();
        result.put("available", available);
        result.put("moving", available && samples >= 10 && lastMotionAt > 0 && SystemClock.elapsedRealtime() - lastMotionAt <= 10000);
        result.put("samples", samples);
        return result;
    }
    @Override public synchronized void onSensorChanged(SensorEvent event) {
        if (watchers == 0) return;
        double magnitude = 0;
        for (int axis = 0; axis < 3; axis++) {
            if (samples == 0) gravity[axis] = event.values[axis];
            gravity[axis] = 0.8f * gravity[axis] + 0.2f * event.values[axis];
            double acceleration = sensor.getType() == Sensor.TYPE_LINEAR_ACCELERATION ? event.values[axis] : event.values[axis] - gravity[axis];
            magnitude += acceleration * acceleration;
        }
        samples++;
        if (samples < 10) return; // Descartar la estabilización inicial del sensor.
        long now = SystemClock.elapsedRealtime();
        while (!activity.isEmpty() && now - activity.peekFirst() > 1500) activity.removeFirst();
        if (Math.sqrt(magnitude) >= 0.35) activity.addLast(now);
        if (activity.size() >= 5 && activity.peekLast() - activity.peekFirst() >= 400) lastMotionAt = now;
    }
    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) {}
    private void release() { if (manager != null) manager.unregisterListener(this); available = false; activity.clear(); }
    @Override protected synchronized void handleOnDestroy() { watchers = 0; release(); }
}
