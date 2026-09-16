package com.drawin3d;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.Choreographer;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;
import com.google.ar.core.ArCoreApk;
import com.google.ar.core.CameraConfig;
import com.google.ar.core.CameraConfigFilter;
import com.google.ar.core.Config;
import com.google.ar.core.Session;
import java.io.File;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity implements SensorEventListener,SceneRenderer.Listener {
    private static final int CAMERA_PERMISSION=10,PICK_IMAGE=20,PICK_PROJECT=21,EXPORT_PROJECT=22;
    private GLSurfaceView surfaceView;
    private SceneRenderer renderer;
    private TextView status,toolLabel;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final ExecutorService arCloser=Executors.newSingleThreadExecutor();
    private PowerManager powerManager;
    private SensorManager sensorManager;private Sensor rotationSensor;
    private float[] initialRotation;
    private boolean resumed,installRequested,wantsAR,permissionPending,closingAR,conservePower;
    private int requestedFps=30;private long lastFrame,lastNotice;
    private long nextPowerPoll;
    private String exportText;
    private Button brushButton,surfaceButton;
    private final Choreographer.FrameCallback ticker=new Choreographer.FrameCallback(){
        @Override public void doFrame(long nanos){
            if(!resumed)return;
            long now=android.os.SystemClock.elapsedRealtime();
            if(now>=nextPowerPoll){
                nextPowerPoll=now+3000;conservePower=powerManager.isPowerSaveMode();
                if(Build.VERSION.SDK_INT>=29)conservePower|=powerManager.getCurrentThermalStatus()>=PowerManager.THERMAL_STATUS_MODERATE;
            }
            int fps=conservePower?Math.min(30,requestedFps):requestedFps;
            if(nanos-lastFrame>=1_000_000_000L/fps-1_000_000L&&renderer.needsFrame(now)){lastFrame=nanos;surfaceView.requestRender();}
            Choreographer.getInstance().postFrameCallback(this);
        }
    };
    @Override public void onCreate(Bundle state){
        super.onCreate(state);powerManager=(PowerManager)getSystemService(POWER_SERVICE);
        sensorManager=(SensorManager)getSystemService(SENSOR_SERVICE);rotationSensor=sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
        if(rotationSensor==null)rotationSensor=sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        renderer=new SceneRenderer(this);surfaceView=new GLSurfaceView(this);surfaceView.setEGLContextClientVersion(2);surfaceView.setEGLConfigChooser(8,8,8,8,16,0);surfaceView.setPreserveEGLContextOnPause(true);
        surfaceView.setRenderer(renderer);surfaceView.setRenderMode(GLSurfaceView.RENDERMODE_WHEN_DIRTY);
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(6,12,17));root.addView(surfaceView,new FrameLayout.LayoutParams(-1,-1));
        root.setOnApplyWindowInsetsListener((v,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets s=insets.getInsets(WindowInsets.Type.systemBars());v.setPadding(s.left,s.top,s.right,s.bottom);}else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        surfaceView.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{int w=r-l,h=b-t;if(w>0&&h>0){int renderWidth=Math.min(720,w);surfaceView.getHolder().setFixedSize(renderWidth,Math.round(renderWidth*h/(float)w));}});
        surfaceView.setOnTouchListener((v,event)->{
            int action=event.getActionMasked();if(action==MotionEvent.ACTION_POINTER_DOWN){queueScene(()->renderer.pointer(MotionEvent.ACTION_CANCEL,0,0,1));return true;}
            if(event.getPointerCount()>1)return true;
            float x=event.getX()/v.getWidth(),y=event.getY()/v.getHeight();float pressure=event.getToolType(0)==MotionEvent.TOOL_TYPE_STYLUS?event.getPressure():1;
            queueScene(()->renderer.pointer(action,x,y,pressure));if(action==MotionEvent.ACTION_UP)v.performClick();return true;
        });
        LinearLayout header=column();header.setPadding(dp(16),dp(12),dp(16),dp(12));header.setBackgroundColor(0xda09141e);
        TextView title=label("DRAW IN 3D",21,0xffdffbf4);title.setTypeface(Typeface.DEFAULT,Typeface.BOLD);header.addView(title);
        header.addView(label("SPATIAL SKETCHBOOK  /  PROTOTYPE 04",10,0xff82a49f));
        LinearLayout modes=row();modes.addView(button("Studio",()->switchMode(SceneRenderer.STUDIO)));modes.addView(button("Look / gyro",()->switchMode(SceneRenderer.LOOK)));modes.addView(button("Camera AR",()->switchMode(SceneRenderer.AR)));header.addView(modes);
        status=label("Studio ready",12,0xffa6c1c9);header.addView(status);
        FrameLayout.LayoutParams hp=new FrameLayout.LayoutParams(-1,-2,Gravity.TOP);root.addView(header,hp);
        TextView cross=label("+",30,0xffd7efe9);cross.setGravity(Gravity.CENTER);FrameLayout.LayoutParams cp=new FrameLayout.LayoutParams(dp(32),dp(40),Gravity.CENTER);root.addView(cross,cp);
        LinearLayout dock=column();dock.setPadding(dp(10),dp(8),dp(10),dp(10));dock.setBackgroundColor(0xef0c1923);
        toolLabel=label("DRAW · drag in the view, or hold DRAW and move phone",11,0xff61e8c6);dock.addView(toolLabel);
        LinearLayout first=row();first.addView(button("Draw",()->setTool("Draw")));first.addView(button("Curve",()->setTool("Curve")));first.addView(button("Look",()->setTool("Look")));
        surfaceButton=button("Air",()->{renderer.surface=!renderer.surface;surfaceButton.setText(renderer.surface?"Surface":"Air");});first.addView(surfaceButton);
        brushButton=button("Pen / settings",this::brushSettings);first.addView(brushButton);
        Button hold=button("HOLD DRAW",()->{});hold.setTextColor(0xff071711);hold.setBackground(tint(0xff61e8c6));hold.setOnTouchListener((v,e)->{if(e.getActionMasked()==MotionEvent.ACTION_DOWN){setTool("Draw");queueScene(()->renderer.hold(true));}else if(e.getActionMasked()==MotionEvent.ACTION_UP||e.getActionMasked()==MotionEvent.ACTION_CANCEL){queueScene(()->renderer.hold(false));}return true;});first.addView(hold);dock.addView(scroll(first));
        LinearLayout second=row();second.addView(button("Origin",()->{if(renderer.mode==SceneRenderer.AR)queueScene(renderer::requestOrigin);else{initialRotation=null;queueScene(renderer::resetView);notice("View recentered.");}}));
        second.addView(button("Paper / surface",this::paperMenu));second.addView(button("+ Block",()->setTool("Block")));second.addView(button("Erase",()->setTool("Erase")));second.addView(button("+ Image",this::pickImage));second.addView(button("+ Marker",this::markerMenu));second.addView(button("Select",()->setTool("Select")));second.addView(button("Adjust",this::adjustMenu));second.addView(button("Delete",()->queueScene(renderer::deleteSelected)));dock.addView(scroll(second));
        LinearLayout third=row();third.addView(button("Undo",()->queueScene(renderer::undo)));third.addView(button("Redo",()->queueScene(renderer::redo)));third.addView(button("Save",()->save(false)));third.addView(button("Files / more",this::fileMenu));third.addView(button("Play / edit",()->queueScene(renderer::togglePlay)));dock.addView(scroll(third));
        FrameLayout.LayoutParams dp=new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM);root.addView(dock,dp);setContentView(root);
        // Camera / ARCore availability is checked only after an explicit Camera AR action.
        if(new File(getFilesDir(),"recovery.json").exists())new AlertDialog.Builder(this).setTitle("Resume your sketch?").setMessage("A local recovery project is available. AR placement will need a new origin.").setPositiveButton("Resume",(d,w)->loadLocal("recovery.json")).setNegativeButton("New sketch",null).show();
        else new AlertDialog.Builder(this).setTitle("Create with the camera off").setMessage("Studio and Look / gyro keep the camera off. Start in Studio: drag to draw in 3D. Use Look / gyro to explore a curved image by turning the phone.\n\nCamera AR is optional and uses more power. Enable it to place art in a real room and walk around it: scan a surface, tap Origin, then tap the floor or wall.\n\nSwitch back to Studio or Look to stop the camera. Gyro-only viewing cannot track your position. Files / more contains the guide and project import/export.").setPositiveButton("Create",null).show();
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private View scroll(View child){HorizontalScrollView scroll=new HorizontalScrollView(this);scroll.setHorizontalScrollBarEnabled(false);scroll.addView(child);return scroll;}
    private TextView label(String text,int size,int color){TextView t=new TextView(this);t.setText(text);t.setTextSize(size);t.setTextColor(color);return t;}
    private GradientDrawable tint(int color){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(12));return d;}
    private Button button(String text,Runnable action){Button b=new Button(this);b.setText(text);b.setTextSize(11);b.setAllCaps(false);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(dp(44));b.setMinimumHeight(dp(44));b.setTextColor(0xffd7e8ed);b.setPadding(dp(12),0,dp(12),0);b.setBackground(tint(0xff1a303d));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-2,dp(44));p.setMargins(0,dp(4),dp(5),0);b.setLayoutParams(p);b.setOnClickListener(v->action.run());return b;}
    private void setTool(String tool){queueScene(renderer::finishStroke);renderer.tool=tool;toolLabel.setText(tool.toUpperCase(java.util.Locale.ROOT)+" · "+(tool.equals("Look")?"drag to rotate in Studio":"tap or drag in the view"));}
    @Override public void status(String message){runOnUiThread(()->{if(!isDestroyed())status.setText(message);});}
    @Override public void notice(String message){runOnUiThread(()->{if(!isDestroyed()){long now=android.os.SystemClock.elapsedRealtime();if(now-lastNotice>600){Toast.makeText(this,message,Toast.LENGTH_LONG).show();lastNotice=now;}}});}
    private void pauseGL(){queueScene(()->{renderer.hold(false);renderer.finishStroke();});surfaceView.onPause();}
    private void queueScene(Runnable action){surfaceView.queueEvent(()->{action.run();renderer.requestSceneFrame();});}
    /** The GL thread must be paused before relinquishing objects owned by this session. */
    private void releaseAR(){
        Session old=renderer.session;
        if(old==null){renderer.detachSession();return;}
        old.pause();renderer.detachSession();renderer.session=null;closeInBackground(old);
    }
    private void closeInBackground(Session old){
        closingAR=true;
        arCloser.execute(()->{
            try{old.close();}catch(RuntimeException error){android.util.Log.w("DrawIn3D","AR cleanup failed",error);}
            finally{runOnUiThread(()->{
                closingAR=false;
                if(!isDestroyed()&&resumed&&wantsAR){pauseGL();startAR();renderer.requestSceneFrame();surfaceView.onResume();}
            });}
        });
    }
    private void switchMode(int mode){
        pauseGL();sensorManager.unregisterListener(this);initialRotation=null;
        releaseAR();
        renderer.mode=mode;wantsAR=mode==SceneRenderer.AR;installRequested=false;
        if(wantsAR)startAR();else if(mode==SceneRenderer.LOOK){if(rotationSensor==null){renderer.mode=SceneRenderer.STUDIO;notice("No orientation sensor. Use Studio Look gestures.");}else sensorManager.registerListener(this,rotationSensor,33_333);}
        if(mode!=SceneRenderer.AR)notice("Camera off. "+(renderer.mode==SceneRenderer.LOOK?"Turn to look around; position is fixed.":"Use touch to edit your scene."));
        renderer.requestSceneFrame();surfaceView.onResume();surfaceView.requestRender();
    }
    private void startAR(){
        if(closingAR){renderer.mode=SceneRenderer.STUDIO;notice("Finishing the previous AR session. Camera AR will resume shortly.");return;}
        if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){if(!permissionPending){permissionPending=true;requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA_PERMISSION);}renderer.mode=SceneRenderer.STUDIO;return;}
        try {
            ArCoreApk.Availability availability=ArCoreApk.getInstance().checkAvailability(this);
            if(availability.isUnsupported()){wantsAR=false;renderer.mode=SceneRenderer.STUDIO;notice("ARCore is unavailable on this device. Studio and Look still work.");return;}
            if(ArCoreApk.getInstance().requestInstall(this,!installRequested)==ArCoreApk.InstallStatus.INSTALL_REQUESTED){installRequested=true;renderer.mode=SceneRenderer.STUDIO;return;}
            if(renderer.session==null){Session session=new Session(this);renderer.session=session;
                List<CameraConfig> configs=session.getSupportedCameraConfigs(new CameraConfigFilter(session).setTargetFps(EnumSet.of(CameraConfig.TargetFps.TARGET_FPS_30)));
                CameraConfig chosen=null;for(CameraConfig c:configs)if(chosen==null||c.getTextureSize().getWidth()*c.getTextureSize().getHeight()<chosen.getTextureSize().getWidth()*chosen.getTextureSize().getHeight())chosen=c;
                if(chosen!=null)session.setCameraConfig(chosen);
                Config config=new Config(session);config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);config.setFocusMode(Config.FocusMode.AUTO);config.setDepthMode(Config.DepthMode.DISABLED);config.setLightEstimationMode(Config.LightEstimationMode.DISABLED);config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);session.configure(config);renderer.session=session;
            }
            renderer.session.resume();renderer.mode=SceneRenderer.AR;renderer.displayRotation=getWindowManager().getDefaultDisplay().getRotation();notice("Scan slowly. Tap Origin, then a detected floor or wall.");
        }catch(Exception e){
            wantsAR=false;renderer.mode=SceneRenderer.STUDIO;
            if(renderer.session!=null){
                Session failed=renderer.session;
                try{failed.pause();}catch(RuntimeException error){android.util.Log.w("DrawIn3D","AR setup pause failed",error);}
                renderer.detachSession();renderer.session=null;closeInBackground(failed);
            }
            notice("Could not start AR: "+e.getClass().getSimpleName()+". Update Google Play Services for AR, then retry.");
        }
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==CAMERA_PERMISSION){permissionPending=false;if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)switchMode(SceneRenderer.AR);else{wantsAR=false;notice("Camera access denied. Studio is available; enable camera in Android settings to use AR.");}}}
    @Override protected void onResume(){super.onResume();resumed=true;nextPowerPoll=0;if(wantsAR)startAR();else if(renderer.mode==SceneRenderer.LOOK&&rotationSensor!=null){initialRotation=null;sensorManager.registerListener(this,rotationSensor,33_333);}renderer.requestSceneFrame();surfaceView.onResume();Choreographer.getInstance().removeFrameCallback(ticker);Choreographer.getInstance().postFrameCallback(ticker);}
    @Override protected void onPause(){
        resumed=false;Choreographer.getInstance().removeFrameCallback(ticker);sensorManager.unregisterListener(this);save(true);pauseGL();if(renderer.session!=null)renderer.session.pause();super.onPause();
    }
    @Override protected void onDestroy(){wantsAR=false;if(renderer.session!=null)releaseAR();arCloser.shutdown();io.shutdown();super.onDestroy();}
    @Override public void onSensorChanged(SensorEvent event){
        float[] r=new float[16];SensorManager.getRotationMatrixFromVector(r,event.values);if(initialRotation==null)initialRotation=r.clone();
        float[] inverse=new float[16],relative=new float[16];Matrix.transposeM(inverse,0,r,0);Matrix.multiplyMM(relative,0,inverse,0,initialRotation,0);renderer.setRotation(relative);
    }
    @Override public void onAccuracyChanged(Sensor sensor,int accuracy){}
    private interface Value {void set(float v);}
    private void slider(LinearLayout box,String name,float initial,float min,float max,Value apply){
        TextView text=label(name+"  "+String.format(java.util.Locale.US,"%.2f",initial),13,0xffd2e4eb);box.addView(text);SeekBar bar=new SeekBar(this);bar.setMax(100);bar.setProgress(Math.round((initial-min)/(max-min)*100));box.addView(bar,new LinearLayout.LayoutParams(-1,dp(40)));
        bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar b,int value,boolean fromUser){float v=min+(max-min)*value/100; text.setText(name+"  "+String.format(java.util.Locale.US,"%.2f",v));if(fromUser)apply.set(v);}public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){}});
    }
    private void brushSettings(){
        queueScene(renderer::finishStroke);LinearLayout box=column();box.setPadding(dp(20),dp(10),dp(20),dp(10));
        LinearLayout brushes=row();for(String name:new String[]{"Pen","Marker","Neon","Spray","Water"})brushes.addView(button(name,()->{renderer.brush=name;brushButton.setText(name+" / settings");}));box.addView(scroll(brushes));
        LinearLayout styles=row();for(String style:new String[]{"solid","dash","dot"})styles.addView(button(style,()->{renderer.pattern=style;notice("Stroke style: "+style);}));box.addView(scroll(styles));
        LinearLayout colors=row();for(int color:new int[]{0xff61e8c6,0xffffaf72,0xffa395ff,0xff63beff,0xffff6b91,0xffffffff,0xff182c3e}){Button b=button("●",()->renderer.ink=color);b.setTextSize(24);b.setTextColor(color);colors.addView(b);}box.addView(scroll(colors));
        slider(box,"Width (metres)",renderer.width,.002f,.10f,v->renderer.width=v);slider(box,"Opacity",renderer.alpha,.1f,1,v->renderer.alpha=v);slider(box,"Air placement distance (metres)",renderer.depth,.25f,3,v->renderer.depth=v);
        box.addView(label("CURVES & STROKE FINISHING",12,0xff61e8c6));
        android.widget.Switch postSmooth=new android.widget.Switch(this);postSmooth.setText("Smooth on release (freehand)");postSmooth.setTextColor(0xffd2e4eb);postSmooth.setChecked(renderer.smoothOnRelease);postSmooth.setOnCheckedChangeListener((b,on)->renderer.smoothOnRelease=on);box.addView(postSmooth);
        slider(box,"Finishing strength",renderer.smoothStrength,.01f,1,v->renderer.smoothStrength=v);box.addView(button("Smooth selected stroke",()->queueScene(renderer::smoothSelected)));
        slider(box,"Curve bend",renderer.curveBend,-1,1,v->renderer.curveBend=v);
        android.widget.Switch shape=new android.widget.Switch(this);shape.setText("S-curve (off = arc)");shape.setTextColor(0xffd2e4eb);shape.setChecked(renderer.sCurve);shape.setOnCheckedChangeListener((b,on)->renderer.sCurve=on);box.addView(shape);
        box.addView(label("Choose Curve in the toolbar, then drag endpoints.\nBend and shape apply to new curves.\nSmoothing runs after freehand input and keeps open endpoints fixed.",12,0xffa6c1c9));
        slider(box,"Image curve (degrees)",renderer.arc,0,300,v->renderer.arc=v);
        box.addView(button("Apply curve to selected image",()->queueScene(()->renderer.adjust(0,0,0,0,0,renderer.arc))));
        Button wet=button(renderer.wet?"Wet drips: ON":"Wet drips: OFF",()->{});wet.setOnClickListener(v->{renderer.wet=!renderer.wet;wet.setText(renderer.wet?"Wet drips: ON":"Wet drips: OFF");});box.addView(wet);
        android.widget.ScrollView scroll=new android.widget.ScrollView(this);scroll.addView(box);new AlertDialog.Builder(this).setTitle("Brush & image settings").setView(scroll).setPositiveButton("Done",null).show();
    }
    private void paperMenu(){
        queueScene(()->{List<SceneData.Entity> snapshot=renderer.snapshot();runOnUiThread(()->{
            java.util.ArrayList<String> names=new java.util.ArrayList<>(),ids=new java.util.ArrayList<>();names.add("＋ Add a paper sheet");names.add("Draw in free 3D space");names.add("Change active paper finish");
            for(SceneData.Entity e:snapshot)if(e.type.equals("paper")){names.add("Paint: "+Paper.NAMES[Paper.kind(e.paperKind)]+" ("+(ids.size()+1)+")");ids.add(e.id);}
            new AlertDialog.Builder(this).setTitle("Paper & surface").setItems(names.toArray(new String[0]),(d,w)->{
                if(w==0||w==2)new AlertDialog.Builder(this).setTitle(w==0?"Add paper":"Paper finish").setItems(Paper.NAMES,(dialog,index)->{queueScene(()->{if(w==0)renderer.addPaper(Paper.KINDS[index]);else renderer.paperKind(Paper.KINDS[index]);});toolLabel.setText("PAPER · draw inside the sheet; choose free space to leave");}).show();
                else{queueScene(()->renderer.usePaper(w==1?"":ids.get(w-3)));toolLabel.setText(w==1?"DRAW · free 3D space":"PAPER · draw inside the sheet");}
            }).show();
        });});
    }
    private void markerMenu(){new AlertDialog.Builder(this).setTitle("Place a game marker").setItems(new String[]{"Start — green","Checkpoint — purple (creation order)","Goal — orange"},(d,w)->setTool(new String[]{"Start","Checkpoint","Goal"}[w])).show();}
    private void adjustMenu(){
        LinearLayout box=column();box.setPadding(dp(20),dp(10),dp(20),dp(10));box.addView(label("Select near the object's centre first.\nOffsets use map axes; one step is 10 cm.",13,0xffd2e4eb));
        LinearLayout a=row();a.addView(button("X −",()->adjust(-.1f,0,0,0,0)));a.addView(button("X +",()->adjust(.1f,0,0,0,0)));a.addView(button("Y −",()->adjust(0,-.1f,0,0,0)));a.addView(button("Y +",()->adjust(0,.1f,0,0,0)));box.addView(a);
        LinearLayout b=row();b.addView(button("Z −",()->adjust(0,0,-.1f,0,0)));b.addView(button("Z +",()->adjust(0,0,.1f,0,0)));b.addView(button("↶ 15°",()->adjust(0,0,0,-15,0)));b.addView(button("↷ 15°",()->adjust(0,0,0,15,0)));box.addView(b);
        LinearLayout c=row();c.addView(button("Smaller",()->adjust(0,0,0,0,-.1f)));c.addView(button("Larger",()->adjust(0,0,0,0,.1f)));box.addView(c);
        new AlertDialog.Builder(this).setTitle("Adjust selected object").setView(box).setPositiveButton("Done",null).show();
    }
    private void adjust(float x,float y,float z,float yaw,float scale){queueScene(()->renderer.adjust(x,y,z,yaw,scale,null));}
    private void pickImage(){Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType("image/*");intent.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,PICK_IMAGE);}
    private void confirmReplace(Runnable action){new AlertDialog.Builder(this).setTitle("Replace the current sketch?").setMessage("Save first if you want to keep your current changes. Saved files are kept.").setPositiveButton("Replace",(d,w)->action.run()).setNegativeButton("Cancel",null).show();}
    private void fileMenu(){
        String[] items={"Load local save","Import project JSON","Export project JSON","New sketch","Studio: move forward","Studio: move backward","30 fps baseline (S9+)","60 fps renderer experiment","Help & prototype limits"};
        new AlertDialog.Builder(this).setTitle("Files & view").setItems(items,(d,which)->{
            switch(which){
                case 0:confirmReplace(()->loadLocal("project.json"));break;
                case 1:confirmReplace(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("*/*");i.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,PICK_PROJECT);});break;
                case 2:export();break;
                case 3:confirmReplace(()->queueScene(()->renderer.replace(Collections.emptyList(),Collections.emptyMap())));break;
                case 4:queueScene(()->renderer.moveView(.25f));break;
                case 5:queueScene(()->renderer.moveView(-.25f));break;
                case 6:requestedFps=30;notice("30 fps rendering target.");break;
                case 7:requestedFps=60;notice("60 fps rendering target. AR camera remains 30 fps; thermals may force 30.");break;
                default:new AlertDialog.Builder(this).setTitle("Prototype guide").setMessage("AR: scan slowly → Origin → tap a detected surface → draw. Surface captures a plane for each stroke; Studio Surface uses the floor. Air uses the distance slider.\n\nTurn the phone in Look / gyro to inspect images. This tracks orientation only. Origin recentres this view. Curves are cylindrical image strips, not reconstructed 3D or spherical panoramas.\n\nSelect near object centres, then Adjust. Checkpoints play in creation order. Tap green Start → purple checkpoints → orange Goal.\n\nSave writes one local project. Export creates a portable JSON including resized images. Loading in AR requires placing the origin again.\n\nLimits: 80 objects, 4000 points, 384 points per stroke, 6 cached images, 4-metre map radius. Drips are stylized, no depth occlusion or full fluid simulation. Target frame rate is not a performance guarantee.").setPositiveButton("Done",null).show();
            }
        }).show();
    }
    private void save(boolean recovery){queueScene(()->{List<SceneData.Entity> snapshot=renderer.snapshot();io.execute(()->{try{ProjectIO.save(this,recovery?"recovery.json":"project.json",SceneData.encode(snapshot));if(!recovery)notice("Saved locally. Use Export for a portable copy.");}catch(Exception e){notice("Save failed: "+e.getMessage());}});});}
    private void loadLocal(String name){io.execute(()->{try{ProjectIO.Project p=ProjectIO.decode(ProjectIO.load(this,name));queueScene(()->renderer.replace(p.entities,p.images));}catch(Exception e){notice("Load failed; current scene kept: "+e.getMessage());}});}
    private void export(){queueScene(()->{List<SceneData.Entity> snapshot=renderer.snapshot();io.execute(()->{try{String text=SceneData.encode(snapshot);runOnUiThread(()->{exportText=text;Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.setType("application/json");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_TITLE,"draw-in-3d-"+System.currentTimeMillis()+".json");startActivityForResult(i,EXPORT_PROJECT);});}catch(Exception e){notice("Export failed: "+e.getMessage());}});});}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);if(result!=RESULT_OK||data==null||data.getData()==null){if(request==EXPORT_PROJECT)exportText=null;return;}Uri uri=data.getData();
        if(request==PICK_IMAGE)io.execute(()->{try{ProjectIO.Image image=ProjectIO.image(this,uri);queueScene(()->renderer.addImage(image.payload,image.aspect,image.bitmap));notice("Image imported. Select / Adjust positions it; settings change its curve.");}catch(Exception e){notice("Image import failed: "+e.getMessage());}});
        if(request==PICK_PROJECT)io.execute(()->{try{String text=new String(ProjectIO.readBounded(getContentResolver().openInputStream(uri),SceneData.MAX_JSON_BYTES),StandardCharsets.UTF_8);ProjectIO.Project p=ProjectIO.decode(text);queueScene(()->renderer.replace(p.entities,p.images));}catch(Exception e){notice("Invalid project; current scene kept: "+e.getMessage());}});
        if(request==EXPORT_PROJECT){String text=exportText;exportText=null;if(text==null){notice("Export expired after app restart. Please export again.");return;}io.execute(()->{try(OutputStream output=getContentResolver().openOutputStream(uri,"wt")){if(output==null)throw new java.io.IOException("Cannot open destination");output.write(text.getBytes(StandardCharsets.UTF_8));notice("Project exported.");}catch(Exception e){notice("Export failed: "+e.getMessage());}});}
    }
}
