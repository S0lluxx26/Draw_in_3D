package com.drawin3d;

import android.graphics.Bitmap;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.GLUtils;
import android.opengl.Matrix;
import android.os.SystemClock;
import com.google.ar.core.Anchor;
import com.google.ar.core.Camera;
import com.google.ar.core.Coordinates2d;
import com.google.ar.core.Frame;
import com.google.ar.core.HitResult;
import com.google.ar.core.Plane;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingState;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/** Scene/document changes run on the GL thread. Session changes happen while it is paused. */
final class SceneRenderer implements GLSurfaceView.Renderer {
    interface Listener { void status(String message); void notice(String message); }
    static final int STUDIO=0, LOOK=1, AR=2;
    final Listener listener;
    final FrameDemand frameDemand=new FrameDemand();
    volatile Session session;
    volatile int mode=STUDIO, displayRotation=0;
    volatile String tool="Draw", brush="Pen", pattern="solid";
    volatile boolean surface=false, wet=false, smoothOnRelease=false, sCurve=false;
    volatile float smoothStrength=.5f, curveBend=.35f;
    private boolean activeCurve, activeSCurve, activeSmooth;
    private float activeStrength, activeBend;private int activeCurveBudget;
    volatile float width=.018f, alpha=1, depth=1.5f, arc=100;
    volatile int ink=0xff61e8c6;
    private final ArrayList<SceneData.Entity> scene=new ArrayList<>(), ordered=new ArrayList<>();
    private final ArrayDeque<ArrayList<SceneData.Entity>> undo=new ArrayDeque<>(),redo=new ArrayDeque<>();
    private final IdentityHashMap<SceneData.Entity,Resource> resources=new IdentityHashMap<>();
    private final HashMap<String,Bitmap> bitmaps=new HashMap<>();
    private final HashMap<String,Integer> textures=new HashMap<>();
    private final HashMap<String,Long> born=new HashMap<>();
    private final ArrayList<String> gameOrder=new ArrayList<>();
    private int gameStep=-1;
    private boolean playing, originTool, pendingTap, startStroke, renderFailed;
    private volatile boolean down,hold;
    private float touchX=.5f,touchY=.5f,pressure=1,lastX,lastY, yaw=0,pitch=0;
    private final float[] eye={0,1.4f,3};
    private final float[] projection=new float[16],view=new float[16],vp=new float[16],root=new float[16],inverseRoot=new float[16];
    private final float[] cameraWorld=new float[16],cameraLocal=new float[16],mvp=new float[16],model=new float[16],temp=new float[16];
    private float[] rotation;
    private Anchor anchor;
    private Frame frame;
    private boolean tracking;
    private int screenWidth=1,screenHeight=1,program,cameraProgram,cameraTexture;
    private int pPosition,pColor,pUv,pFall,uMatrix,uTexture,uTextured,uWet,uHighlight,uPaperClip;
    private FloatBuffer quad,uv;
    private Resource grid,originIndicator,activeResource;
    private SceneData.Entity active;
    private String selected, activePaperId="";
    private float[] planePoint,planeNormal;
    private long fpsStart=SystemClock.elapsedRealtime(),lastStatus,lastDraw;
    private int frames; private float fps;

    SceneRenderer(Listener listener){this.listener=listener;Matrix.setIdentityM(root,0);Matrix.setIdentityM(inverseRoot,0);}
    void requestSceneFrame(){frameDemand.wakeUntil(SystemClock.elapsedRealtime()+400);}
    boolean needsFrame(long now){return frameDemand.shouldDraw(now,mode==AR,down||hold);}
    private static FloatBuffer floats(float[] values){FloatBuffer b=ByteBuffer.allocateDirect(values.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();b.put(values).position(0);return b;}
    private static int shader(int type,String source){
        int shader=GLES20.glCreateShader(type);GLES20.glShaderSource(shader,source);GLES20.glCompileShader(shader);
        int[] ok=new int[1];GLES20.glGetShaderiv(shader,GLES20.GL_COMPILE_STATUS,ok,0);
        if(ok[0]==0)throw new IllegalStateException(GLES20.glGetShaderInfoLog(shader));return shader;
    }
    private static int program(String vertex,String fragment){
        int p=GLES20.glCreateProgram(),v=shader(GLES20.GL_VERTEX_SHADER,vertex),f=shader(GLES20.GL_FRAGMENT_SHADER,fragment);
        GLES20.glAttachShader(p,v);GLES20.glAttachShader(p,f);GLES20.glLinkProgram(p);int[] ok=new int[1];GLES20.glGetProgramiv(p,GLES20.GL_LINK_STATUS,ok,0);
        GLES20.glDeleteShader(v);GLES20.glDeleteShader(f);if(ok[0]==0)throw new IllegalStateException(GLES20.glGetProgramInfoLog(p));return p;
    }
    private static class Resource {
        int buffer,count;
        Resource(Geometry mesh){int[] ids=new int[1];GLES20.glGenBuffers(1,ids,0);buffer=ids[0];update(mesh);}
        void update(Geometry mesh){count=mesh.count();GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER,buffer);GLES20.glBufferData(GLES20.GL_ARRAY_BUFFER,count*Geometry.STRIDE*4,mesh.buffer(),GLES20.GL_STATIC_DRAW);GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER,0);}
        void dispose(){GLES20.glDeleteBuffers(1,new int[]{buffer},0);}
    }
    @Override public void onSurfaceCreated(GL10 gl,EGLConfig config){
        requestSceneFrame();
        try {
            resources.clear();textures.clear();activeResource=null;renderFailed=false;
            program=program("uniform mat4 uM;uniform float uWet;attribute vec3 aP;attribute vec4 aC;attribute vec2 aU;attribute vec3 aF;varying vec4 vC;varying vec2 vU;void main(){gl_Position=uM*vec4(aP+aF*uWet,1.0);vC=aC;vU=aU;}",
                    "precision mediump float;uniform sampler2D uT;uniform float uTextured;uniform float uHighlight;uniform float uPaperClip;varying vec4 vC;varying vec2 vU;void main(){if(uPaperClip>0.5&&(vU.x<0.0||vU.x>1.0||vU.y<0.0||vU.y>1.0))discard;vec4 c=vC;if(uTextured>0.5)c*=texture2D(uT,vU);c.rgb=mix(c.rgb,vec3(1.0,.85,.4),uHighlight);if(c.a<.01)discard;gl_FragColor=c;}");
            pPosition=GLES20.glGetAttribLocation(program,"aP");pColor=GLES20.glGetAttribLocation(program,"aC");pUv=GLES20.glGetAttribLocation(program,"aU");pFall=GLES20.glGetAttribLocation(program,"aF");
            uMatrix=GLES20.glGetUniformLocation(program,"uM");uTexture=GLES20.glGetUniformLocation(program,"uT");uTextured=GLES20.glGetUniformLocation(program,"uTextured");uWet=GLES20.glGetUniformLocation(program,"uWet");uHighlight=GLES20.glGetUniformLocation(program,"uHighlight");uPaperClip=GLES20.glGetUniformLocation(program,"uPaperClip");
            cameraProgram=program("attribute vec2 aP;attribute vec2 aU;varying vec2 vU;void main(){gl_Position=vec4(aP,0.0,1.0);vU=aU;}","#extension GL_OES_EGL_image_external : require\nprecision mediump float;uniform samplerExternalOES uT;varying vec2 vU;void main(){gl_FragColor=texture2D(uT,vU);}");
            int[] id=new int[1];GLES20.glGenTextures(1,id,0);cameraTexture=id[0];GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,cameraTexture);
            GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);
            GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);
            quad=floats(new float[]{-1,-1,1,-1,-1,1,1,1});uv=floats(new float[8]);grid=new Resource(Geometry.grid());originIndicator=new Resource(Geometry.origin());
            if(active!=null)activeResource=new Resource(mesh(active));
        }catch(RuntimeException e){renderFailed=true;listener.notice("Graphics initialization failed: "+e.getMessage());}
    }
    @Override public void onSurfaceChanged(GL10 gl,int width,int height){screenWidth=width;screenHeight=height;GLES20.glViewport(0,0,width,height);requestSceneFrame();}
    @Override public void onDrawFrame(GL10 gl){
        if(renderFailed)return;
        GLES20.glClearColor(.025f,.045f,.065f,1);GLES20.glDepthMask(true);GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);
        long now=SystemClock.elapsedRealtime();if(now-lastDraw>250){fpsStart=now;frames=0;}lastDraw=now;
        frames++;if(now-fpsStart>1000){fps=frames*1000f/(now-fpsStart);fpsStart=now;frames=0;}
        tracking=false;
        try {
            if(mode==AR&&session!=null){
                session.setDisplayGeometry(displayRotation,screenWidth,screenHeight);session.setCameraTextureName(cameraTexture);frame=session.update();
                if(frame.getTimestamp()!=0)drawCamera();Camera camera=frame.getCamera();tracking=camera.getTrackingState()==TrackingState.TRACKING;
                camera.getViewMatrix(view,0);camera.getProjectionMatrix(projection,0,.03f,30);camera.getPose().toMatrix(cameraWorld,0);
                if(anchor!=null){anchor.getPose().toMatrix(root,0);Matrix.invertM(inverseRoot,0,root,0);tracking&=anchor.getTrackingState()==TrackingState.TRACKING;}
            }else{
                frame=null;tracking=true;Matrix.setIdentityM(root,0);Matrix.setIdentityM(inverseRoot,0);
                Matrix.perspectiveM(projection,0,60,screenWidth/(float)screenHeight,.03f,30);
                float[] r; synchronized(this){r=rotation==null?null:rotation.clone();}
                if(mode==LOOK&&r!=null){System.arraycopy(r,0,view,0,16);Matrix.translateM(view,0,-eye[0],-eye[1],-eye[2]);}
                else {Matrix.setIdentityM(view,0);Matrix.rotateM(view,0,pitch,1,0,0);Matrix.rotateM(view,0,yaw,0,1,0);Matrix.translateM(view,0,-eye[0],-eye[1],-eye[2]);}
                Matrix.invertM(cameraWorld,0,view,0);
            }
            Matrix.multiplyMM(cameraLocal,0,inverseRoot,0,cameraWorld,0);
            Matrix.multiplyMM(temp,0,view,0,root,0);Matrix.multiplyMM(vp,0,projection,0,temp,0);
            if(!tracking){finishStroke();down=false;hold=false;startStroke=false;pendingTap=false;}
            else processInput();
            GLES20.glEnable(GLES20.GL_DEPTH_TEST);GLES20.glDisable(GLES20.GL_CULL_FACE);GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA,GLES20.GL_ONE_MINUS_SRC_ALPHA);
            if(mode!=AR){Matrix.setIdentityM(model,0);draw(grid,model,0,1,false);}
            if(mode!=AR||(anchor!=null&&tracking)){
                Matrix.setIdentityM(model,0);draw(originIndicator,model,0,1,false);
                resources.entrySet().removeIf(entry->{if(entry.getKey()!=active&&!scene.contains(entry.getKey())){entry.getValue().dispose();return true;}return false;});
                ordered.clear();ordered.addAll(scene);ordered.sort((a,b)->a.type.equals("paper")!=b.type.equals("paper")?(a.type.equals("paper")?-1:1):Float.compare(distanceToCamera(b),distanceToCamera(a)));
                for(SceneData.Entity e:ordered){
                    if(playing&&gameOrder.indexOf(e.id)>=0&&gameOrder.indexOf(e.id)<gameStep)continue;
                    Resource res=resources.get(e);if(res==null){res=new Resource(mesh(e));resources.put(e,res);}
                    drawEntity(e,res,now);
                }
                if(active!=null&&activeResource!=null)drawEntity(active,activeResource,now);
            }
            GLES20.glDepthMask(true);
            if(now-lastStatus>350){lastStatus=now;String state=mode==AR?(tracking?(anchor==null?"Scan a surface · Set origin to begin":"AR tracking · origin placed"):"Tracking paused · move slowly in good light"):mode==LOOK?"LOOK · orientation only; fixed position":"STUDIO · drag with Look tool to rotate";
                if(playing)state="PLAY · "+(gameStep==0?"Tap the green Start":gameStep>=gameOrder.size()?"Complete! Tap Play to edit":"Tap marker "+gameStep+" / "+(gameOrder.size()-1));
                listener.status(state+"\n"+Math.round(fps)+" fps · "+scene.size()+"/80 objects · "+pointCount()+"/4000 points"+(selected==null?"":" · selected"));}
        }catch(Exception e){finishStroke();down=false;hold=false;listener.notice("AR/render paused: "+e.getClass().getSimpleName()+". Switch to Studio, then retry AR.");renderFailed=true;}
    }
    private void drawCamera(){
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);GLES20.glDepthMask(false);GLES20.glDisable(GLES20.GL_BLEND);GLES20.glUseProgram(cameraProgram);
        frame.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,quad,Coordinates2d.TEXTURE_NORMALIZED,uv);
        int p=GLES20.glGetAttribLocation(cameraProgram,"aP"),u=GLES20.glGetAttribLocation(cameraProgram,"aU");
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER,0);quad.position(0);uv.position(0);GLES20.glVertexAttribPointer(p,2,GLES20.GL_FLOAT,false,0,quad);GLES20.glVertexAttribPointer(u,2,GLES20.GL_FLOAT,false,0,uv);
        GLES20.glEnableVertexAttribArray(p);GLES20.glEnableVertexAttribArray(u);GLES20.glActiveTexture(GLES20.GL_TEXTURE0);GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,cameraTexture);GLES20.glUniform1i(GLES20.glGetUniformLocation(cameraProgram,"uT"),0);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP,0,4);GLES20.glDisableVertexAttribArray(p);GLES20.glDisableVertexAttribArray(u);GLES20.glDepthMask(true);
    }
    private SceneData.Entity paper(String id){for(SceneData.Entity e:scene)if(e.id.equals(id)&&e.type.equals("paper"))return e;return null;}
    private Geometry mesh(SceneData.Entity e){SceneData.Entity p=paper(e.paperId);return e.type.equals("paper")?Paper.sheet(e):e.type.equals("stroke")?(p==null?Geometry.stroke(e):Paper.ink(e,p)):e.type.equals("image")?Geometry.image(e):e.type.equals("block")?Geometry.block(e):Geometry.marker(e);}
    private float distanceToCamera(SceneData.Entity e){float x=e.position[0]-cameraLocal[12],y=e.position[1]-cameraLocal[13],z=e.position[2]-cameraLocal[14];return x*x+y*y+z*z;}
    private void drawEntity(SceneData.Entity e,Resource res,long now){
        Matrix.setIdentityM(model,0);Matrix.translateM(model,0,e.position[0],e.position[1],e.position[2]);Matrix.rotateM(model,0,e.yaw,0,1,0);Matrix.scaleM(model,0,e.scale,e.scale,e.scale);
        int texture=0;
        if(e.type.equals("image")){
            Integer cached=textures.get(e.id);if(cached==null){Bitmap bitmap=bitmaps.get(e.id);if(bitmap==null)return;int[] id=new int[1];GLES20.glGenTextures(1,id,0);texture=id[0];GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,texture);
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);
                GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,bitmap,0);textures.put(e.id,texture);
            }else texture=cached;
        }
        SceneData.Entity paper=paper(e.paperId);boolean paperInk=paper!=null;if(e.type.equals("paper")||paperInk)texture=paperTexture(paperInk?paper.paperKind:e.paperKind,paperInk);
        float growth=Math3.clamp((now-born.getOrDefault(e.id,now-5000L))/4000f,0,1);growth=1-(1-growth)*(1-growth);
        // All content is sorted back-to-front; opaque strokes still write depth.
        GLES20.glDepthMask(!paperInk&&e.alpha>=.999f&&!e.type.equals("image")&&!e.brush.equals("Water")&&!e.brush.equals("Marker")&&!e.brush.equals("Neon"));
        draw(res,model,texture,growth,playing?(gameStep<gameOrder.size()&&e.id.equals(gameOrder.get(gameStep))):e.id.equals(selected),paperInk);
    }
    private int paperTexture(String kind,boolean ink){
        String key="paper:"+kind+":"+ink;Integer cached=textures.get(key);if(cached!=null)return cached;
        ByteBuffer pixels=ByteBuffer.allocateDirect(256*256*4);for(int c:Paper.pixels(kind,ink)){pixels.put((byte)(c>>16));pixels.put((byte)(c>>8));pixels.put((byte)c);pixels.put((byte)(c>>>24));}pixels.position(0);
        int[] id=new int[1];GLES20.glGenTextures(1,id,0);GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,id[0]);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D,0,GLES20.GL_RGBA,256,256,0,GLES20.GL_RGBA,GLES20.GL_UNSIGNED_BYTE,pixels);textures.put(key,id[0]);return id[0];
    }
    private void draw(Resource res,float[] transform,int texture,float growth,boolean selected){draw(res,transform,texture,growth,selected,false);}
    private void draw(Resource res,float[] transform,int texture,float growth,boolean selected,boolean paperClip){
        GLES20.glUseProgram(program);Matrix.multiplyMM(mvp,0,vp,0,transform,0);GLES20.glUniformMatrix4fv(uMatrix,1,false,mvp,0);
        GLES20.glUniform1f(uPaperClip,paperClip?1:0);GLES20.glUniform1f(uWet,growth);GLES20.glUniform1f(uHighlight,selected?.22f:0);GLES20.glUniform1f(uTextured,texture==0?0:1);GLES20.glUniform1i(uTexture,0);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,texture);
        GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER,res.buffer);int stride=Geometry.STRIDE*4;
        GLES20.glEnableVertexAttribArray(pPosition);GLES20.glVertexAttribPointer(pPosition,3,GLES20.GL_FLOAT,false,stride,0);
        GLES20.glEnableVertexAttribArray(pColor);GLES20.glVertexAttribPointer(pColor,4,GLES20.GL_FLOAT,false,stride,12);
        GLES20.glEnableVertexAttribArray(pUv);GLES20.glVertexAttribPointer(pUv,2,GLES20.GL_FLOAT,false,stride,28);
        GLES20.glEnableVertexAttribArray(pFall);GLES20.glVertexAttribPointer(pFall,3,GLES20.GL_FLOAT,false,stride,36);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,res.count);GLES20.glDisableVertexAttribArray(pPosition);GLES20.glDisableVertexAttribArray(pColor);GLES20.glDisableVertexAttribArray(pUv);GLES20.glDisableVertexAttribArray(pFall);GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER,0);
    }
    synchronized void setRotation(float[] viewRotation){
        boolean changed=rotation==null;
        if(!changed)for(int i=0;i<12;i++)if(Math.abs(rotation[i]-viewRotation[i])>.001f){changed=true;break;}
        if(changed){rotation=viewRotation.clone();requestSceneFrame();}
    }
    void pointer(int action,float x,float y,float pressure){
        if(action==0){down=true;startStroke=true;pendingTap=true;lastX=x;lastY=y;}
        if(action==2&&tool.equals("Look")&&mode==STUDIO&&!playing){yaw+=(x-lastX)*140;pitch=Math3.clamp(pitch+(y-lastY)*100,-80,80);}
        lastX=x;lastY=y;touchX=x;touchY=y;this.pressure=Math3.clamp(pressure,.2f,1.5f);
        if(action==0&&(tool.equals("Draw")||tool.equals("Curve"))&&!playing&&!originTool&&tracking&&(mode!=AR||anchor!=null)){startStroke=false;beginStroke(x,y);}
        if(action==1){if(active!=null){float[][] ray=ray(x,y);float[] p=active.surface?Math3.planeHit(ray[0],ray[1],planePoint,planeNormal):Math3.add(ray[0],Math3.mul(ray[1],depth));if(p!=null)addPoint(p);}down=false;finishStroke();startStroke=false;}
        if(action==3){down=false;hold=false;startStroke=false;cancelStroke();}
    }
    void hold(boolean held){hold=held;touchX=.5f;touchY=.5f;pressure=1;if(held){startStroke=true;down=true;}else{down=false;finishStroke();}}
    private float[][] ray(float x,float y){
        float[] origin={cameraLocal[12],cameraLocal[13],cameraLocal[14]};
        float vx=(2*x-1+projection[8])/projection[0],vy=(1-2*y+projection[9])/projection[5];
        float[] d={cameraLocal[0]*vx+cameraLocal[4]*vy-cameraLocal[8],cameraLocal[1]*vx+cameraLocal[5]*vy-cameraLocal[9],cameraLocal[2]*vx+cameraLocal[6]*vy-cameraLocal[10]};return new float[][]{origin,Math3.norm(d)};
    }
    private float[] toLocal(float[] p){float[] out=new float[4];Matrix.multiplyMV(out,0,inverseRoot,0,new float[]{p[0],p[1],p[2],1},0);return new float[]{out[0],out[1],out[2]};}
    private float[] directionLocal(float[] p){float[] out=new float[4];Matrix.multiplyMV(out,0,inverseRoot,0,new float[]{p[0],p[1],p[2],0},0);return Math3.norm(out);}
    private HitResult surfaceHit(float x,float y){
        if(frame==null)return null;for(HitResult h:frame.hitTest(x*screenWidth,y*screenHeight))if(h.getTrackable() instanceof Plane){Plane p=(Plane)h.getTrackable();if(p.getTrackingState()==TrackingState.TRACKING&&p.isPoseInPolygon(h.getHitPose())&&h.getDistance()<8)return h;}return null;
    }
    private float[] placement(float x,float y,boolean requireSurface){
        float[][] r=ray(x,y);if(!requireSurface)return Math3.add(r[0],Math3.mul(r[1],depth));
        if(mode==AR){HitResult hit=surfaceHit(x,y);return hit==null?null:toLocal(hit.getHitPose().getTranslation());}
        return Math3.planeHit(r[0],r[1],new float[]{0,0,0},new float[]{0,1,0});
    }
    private void processInput(){
        if(pendingTap){pendingTap=false;
            if(originTool&&mode==AR){placeOrigin();return;}
            if(mode==AR&&anchor==null){listener.notice("Choose Set origin and tap a detected surface first.");down=false;return;}
            if(playing){gameTap();return;}
            if(tool.equals("Select")){selectAt(touchX,touchY);return;}
            if(tool.equals("Erase")){selected=pick(touchX,touchY);if(selected!=null)deleteSelected();down=false;return;}
            if(tool.equals("Block")){addBlock();down=false;return;}
            if(tool.equals("Start")||tool.equals("Checkpoint")||tool.equals("Goal")){addMarker(tool.toLowerCase(java.util.Locale.ROOT));down=false;return;}
        }
        if(!down||playing||(!tool.equals("Draw")&&!tool.equals("Curve"))||(mode==AR&&anchor==null))return;
        float x=hold?.5f:touchX,y=hold?.5f:touchY;
        if(startStroke){startStroke=false;beginStroke(x,y);}
        if(active==null)return;
        float[][] r=ray(x,y);float[] p=active.surface?Math3.planeHit(r[0],r[1],planePoint,planeNormal):Math3.add(r[0],Math3.mul(r[1],depth));
        if(p!=null)addPoint(p);
    }
    private void placeOrigin(){
        HitResult hit=surfaceHit(touchX,touchY);if(hit==null){listener.notice("No plane here yet. Scan a textured floor or wall, then tap.");return;}
        finishStroke();float[] p=hit.getHitPose().getTranslation();float angle=(float)Math.atan2(cameraWorld[8],cameraWorld[10]);
        Pose origin=new Pose(p,new float[]{0,(float)Math.sin(angle/2),0,(float)Math.cos(angle/2)});
        if(anchor!=null)anchor.detach();anchor=session.createAnchor(origin);origin.toMatrix(root,0);Matrix.invertM(inverseRoot,0,root,0);originTool=false;down=false;selected=null;
        listener.notice("Origin set. Imported scenes are manually aligned here.");
    }
    void requestOrigin(){finishStroke();originTool=true;listener.notice("Tap a detected floor or wall to place the map origin. Aim in the map's forward direction.");}
    private int pointCount(){int n=0;for(SceneData.Entity e:scene)n+=e.points.size();if(active!=null)n+=active.points.size();return n;}
    private void beginStroke(float x,float y){
        if(scene.size()>=SceneData.MAX_OBJECTS||pointCount()>=SceneData.MAX_POINTS||(tool.equals("Curve")&&SceneData.MAX_POINTS-pointCount()<3)){listener.notice("Scene budget reached. Erase objects or save and start a new map.");down=false;return;}
        SceneData.Entity paper=paper(activePaperId);float[][] ray=ray(x,y);float[] p=paper==null?placement(x,y,surface):Math3.planeHit(ray[0],ray[1],paper.position,Math3.rotateY(paper.normal,paper.yaw));if(p!=null&&paper!=null&&!Paper.inside(paper,p))p=null;if(p==null){listener.notice("Aim inside the active paper. In free space, Studio Surface mode uses the floor grid.");down=false;return;}
        if(Math3.length(p)>SceneData.RADIUS-.4f){listener.notice("Keep drawing within four metres of the map origin.");down=false;return;}
        activeCurve=tool.equals("Curve");activeSCurve=sCurve;activeBend=curveBend;activeCurveBudget=Math.min(65,SceneData.MAX_POINTS-pointCount());activeSmooth=smoothOnRelease;activeStrength=smoothStrength;
        active=new SceneData.Entity();active.position=p.clone();active.brush=brush;active.pattern=pattern;active.color=ink;active.width=width;active.alpha=alpha;active.wet=wet;active.surface=paper!=null||surface;active.paperId=paper==null?"":paper.id;
        if(paper!=null){planePoint=paper.position.clone();planeNormal=Math3.rotateY(paper.normal,paper.yaw);active.normal=planeNormal.clone();}
        else if(surface){planePoint=p.clone();HitResult h=mode==AR?surfaceHit(x,y):null;planeNormal=h==null?new float[]{0,1,0}:directionLocal(h.getHitPose().getTransformedAxis(1,1));active.normal=planeNormal.clone();}
        else active.normal=directionLocal(new float[]{cameraWorld[8],cameraWorld[9],cameraWorld[10]});
        if(activeCurve){active.surface=true;planePoint=p.clone();planeNormal=active.normal.clone();}
        long now=SystemClock.elapsedRealtime();born.put(active.id,now);if(active.wet&&(paper==null||paper.paperKind.equals("coated")))frameDemand.wakeUntil(now+4100);selected=null;addPoint(p);
    }
    private void addPoint(float[] p){
        if(active==null)return;SceneData.Entity paper=paper(active.paperId);if(paper!=null&&!Paper.inside(paper,p))return;if(Math3.length(p)>SceneData.RADIUS-.4f){finishStroke();down=false;return;}
        float[] local=Math3.sub(p,active.position);int count=active.points.size();
        if(activeCurve){if(count>0&&Math3.distance(local,active.points.get(count-1))<.001f)return;ArrayList<float[]> points=StrokeProcessing.curve(local,active.normal,activeBend,activeSCurve,activeCurveBudget,count>0?active.points.get(0)[3]:pressure,pressure);SceneData.Entity candidate=active.copy();candidate.points.clear();candidate.points.addAll(points);if(!SceneData.withinBounds(candidate))return;active.points.clear();active.points.addAll(points);Geometry mesh=mesh(active);if(activeResource==null)activeResource=new Resource(mesh);else activeResource.update(mesh);return;}
        if(count>0){float[] prev=active.points.get(count-1);float gap=Math3.distance(prev,local);if(gap<Math.max(.006f,active.width*.25f))return;
            if(gap>.45f){finishStroke();down=false;listener.notice("Stroke ended after a tracking/motion jump.");return;}
            int steps=Math.min(8,Math.max(1,(int)(gap/.025f)));
            for(int i=1;i<=steps;i++){if(active.points.size()>=SceneData.MAX_STROKE||pointCount()>=SceneData.MAX_POINTS)break;float t=i/(float)steps;active.points.add(new float[]{prev[0]+(local[0]-prev[0])*t,prev[1]+(local[1]-prev[1])*t,prev[2]+(local[2]-prev[2])*t,pressure});}
        }else active.points.add(new float[]{local[0],local[1],local[2],pressure});
        Geometry geometry=mesh(active);if(activeResource==null)activeResource=new Resource(geometry);else activeResource.update(geometry);
        if(active.points.size()>=SceneData.MAX_STROKE||pointCount()>=SceneData.MAX_POINTS){finishStroke();down=false;listener.notice("Stroke limit reached. Lift and start the next stroke.");}
    }
    void finishStroke(){
        if(active==null)return;if(activeCurve&&active.points.size()<3){cancelStroke();return;}
        if(!activeCurve&&activeSmooth&&active.points.size()>2){ArrayList<float[]> points=StrokeProcessing.smooth(active.points,activeStrength,Math.min(SceneData.MAX_STROKE,SceneData.MAX_POINTS-pointCount()+active.points.size()));SceneData.Entity candidate=active.copy();candidate.points.clear();candidate.points.addAll(points);if(SceneData.withinBounds(candidate)){active.points.clear();active.points.addAll(points);if(activeResource!=null)activeResource.update(mesh(active));}}
        if(!active.points.isEmpty()){checkpoint();scene.add(active);if(activeResource!=null)resources.put(active,activeResource);}
        else if(activeResource!=null)activeResource.dispose();active=null;activeResource=null;
    }
    private void cancelStroke(){if(activeResource!=null)activeResource.dispose();if(active!=null)born.remove(active.id);active=null;activeResource=null;}
    void smoothSelected(){
        if(playing)return;finishStroke();for(int i=0;i<scene.size();i++){SceneData.Entity old=scene.get(i);if(!old.id.equals(selected)||!old.type.equals("stroke")||old.points.size()<3)continue;SceneData.Entity e=old.copy();e.points.clear();e.points.addAll(StrokeProcessing.smooth(old.points,smoothStrength,Math.min(SceneData.MAX_STROKE,SceneData.MAX_POINTS-pointCount()+old.points.size())));if(!SceneData.withinBounds(e))return;checkpoint();scene.set(i,e);listener.notice("Stroke smoothed. Undo restores the original.");return;}listener.notice("Select a stroke with at least three points first.");
    }
    private void checkpoint(){undo.addLast(new ArrayList<>(scene));while(undo.size()>20)undo.removeFirst();redo.clear();}
    void undo(){if(playing)return;finishStroke();if(undo.isEmpty())return;redo.addLast(new ArrayList<>(scene));scene.clear();scene.addAll(undo.removeLast());selected=null;}
    void redo(){if(playing)return;finishStroke();if(redo.isEmpty())return;undo.addLast(new ArrayList<>(scene));scene.clear();scene.addAll(redo.removeLast());selected=null;}
    void addPaper(String kind){
        finishStroke();if(playing||scene.size()>=SceneData.MAX_OBJECTS)return;if(mode==AR&&(!tracking||anchor==null)){listener.notice("Set an AR origin first.");return;}
        SceneData.Entity e=new SceneData.Entity();e.type="paper";e.paperKind=kind;e.panelWidth=2.4f;e.aspect=1.5f;e.color=0xffffffff;e.position=placement(.5f,.5f,false);e.normal=directionLocal(new float[]{cameraWorld[8],cameraWorld[9],cameraWorld[10]});
        if(e.position==null||!SceneData.withinBounds(e)){listener.notice("Move closer to the origin or lower placement distance.");return;}checkpoint();scene.add(e);usePaper(e.id);brush="Water";width=.06f;alpha=.85f;wet=true;ink=0xff3974b8;
    }
    void usePaper(String id){finishStroke();activePaperId=paper(id)==null?"":id;tool="Draw";selected=activePaperId.isEmpty()?null:activePaperId;listener.notice(activePaperId.isEmpty()?"Drawing in free 3D space.":"Painting on paper. Select and Adjust moves the sheet with its paint.");}
    void paperKind(String kind){
        if(playing)return;finishStroke();SceneData.Entity p=paper(selected);if(p==null)p=paper(activePaperId);if(p==null){listener.notice("Choose a paper in Paper / surface first.");return;}String id=p.id;checkpoint();for(int i=0;i<scene.size();i++){SceneData.Entity e=scene.get(i);if(e.id.equals(id)||e.paperId.equals(id)){SceneData.Entity copy=e.copy();if(copy.id.equals(id))copy.paperKind=kind;scene.set(i,copy);}}
    }
    private void addBlock(){
        if(scene.size()>=SceneData.MAX_OBJECTS)return;float[] p=placement(touchX,touchY,surface);if(p==null)return;
        SceneData.Entity e=new SceneData.Entity();e.type="block";e.position=p;e.color=ink;e.alpha=alpha;
        if(!SceneData.withinBounds(e)){listener.notice("Block is outside the map radius.");return;}checkpoint();scene.add(e);selected=e.id;
    }
    private void addMarker(String type){
        if(scene.size()>=SceneData.MAX_OBJECTS)return;
        if((type.equals("start")||type.equals("goal"))&&scene.stream().anyMatch(e->e.type.equals(type))){listener.notice("The map already has a "+type+". Select and move it.");return;}
        float[] p=placement(touchX,touchY,surface);if(p==null)return;SceneData.Entity e=new SceneData.Entity();e.type=type;e.position=p;
        e.color=type.equals("start")?0xff61e8c6:type.equals("goal")?0xffffa467:0xffa395ff;
        if(!SceneData.withinBounds(e)){listener.notice("Marker is outside the map radius.");return;}checkpoint();scene.add(e);selected=e.id;
    }
    void addImage(String payload,float aspect,Bitmap bitmap){
        finishStroke();if(playing||scene.size()>=SceneData.MAX_OBJECTS||bitmaps.size()>=SceneData.MAX_IMAGES){bitmap.recycle();listener.notice("Image cache limit reached (6). Save and reopen to release deleted images.");return;}
        if(mode==AR&&(!tracking||anchor==null)){bitmap.recycle();listener.notice("Set an AR origin before placing an image.");return;}
        SceneData.Entity e=new SceneData.Entity();e.type="image";e.image=payload;e.aspect=aspect;e.arc=arc;e.panelWidth=1.6f;
        e.position=placement(.5f,.5f,false);e.yaw=(float)Math.toDegrees(Math.atan2(cameraLocal[8],cameraLocal[10]));
        if(!SceneData.withinBounds(e)){e.panelWidth=.8f;if(!SceneData.withinBounds(e)){bitmap.recycle();listener.notice("Move closer to the origin or lower placement distance.");return;}}
        checkpoint();scene.add(e);bitmaps.put(e.id,bitmap);selected=e.id;
    }
    private String pick(float x,float y){
        String found=null;float nearest=Float.MAX_VALUE;
        for(SceneData.Entity e:scene){
            ArrayList<float[]> candidates=e.points;
            int samples=Math.max(1,candidates.size());
            for(int i=0;i<samples;i+=Math.max(1,samples/40)){
                float[] local=candidates.isEmpty()?new float[]{0,0,0}:candidates.get(i);
                float[] p=Math3.add(e.position,Math3.rotateY(Math3.mul(local,e.scale),e.yaw));
                float[] clip=new float[4];Matrix.multiplyMV(clip,0,vp,0,new float[]{p[0],p[1],p[2],1},0);if(clip[3]<=0)continue;
                float dx=(clip[0]/clip[3]+1)*.5f-x,dy=(1-clip[1]/clip[3])*.5f-y;
                float d=dx*dx+dy*dy;if(d<.0064f&&clip[3]<nearest){found=e.id;nearest=clip[3];}
            }
        }return found;
    }
    private void selectAt(float x,float y){selected=pick(x,y);if(paper(selected)!=null)activePaperId=selected;listener.notice(selected==null?"Tap close to a stroke, marker, or image centre.":"Selected. Use Adjust or Delete.");}
    void deleteSelected(){if(playing)return;finishStroke();if(selected==null){listener.notice("Select an object first.");return;}checkpoint();scene.removeIf(e->e.id.equals(selected)||e.paperId.equals(selected));selected=null;}
    void adjust(float dx,float dy,float dz,float degrees,float scaleDelta,Float newArc){
        if(playing)return;finishStroke();for(int i=0;i<scene.size();i++){SceneData.Entity old=scene.get(i);if(!old.id.equals(selected))continue;
            SceneData.Entity e=old.copy();e.position[0]+=dx;e.position[1]+=dy;e.position[2]+=dz;e.yaw+=degrees;e.scale=Math3.clamp(e.scale+scaleDelta,.1f,4);if(newArc!=null&&e.type.equals("image"))e.arc=newArc;
            if(!SceneData.withinBounds(e)){listener.notice("Adjustment would exceed the four-metre map radius.");return;}ArrayList<SceneData.Entity> next=new ArrayList<>(scene);next.set(i,e);
            if(old.type.equals("paper"))for(int j=0;j<next.size();j++){SceneData.Entity child=next.get(j);if(!child.paperId.equals(old.id))continue;SceneData.Entity copy=child.copy();float ratio=e.scale/old.scale;copy.position=Math3.add(e.position,Math3.rotateY(Math3.mul(Math3.sub(child.position,old.position),ratio),degrees));copy.yaw+=degrees;copy.scale*=ratio;if(copy.scale<.1f||copy.scale>4||!SceneData.withinBounds(copy)){listener.notice("Paper paint would exceed scene limits.");return;}next.set(j,copy);}
            checkpoint();scene.clear();scene.addAll(next);return;
        }listener.notice("Select an object to adjust it.");
    }
    void togglePlay(){
        finishStroke();if(playing){playing=false;gameStep=-1;listener.notice("Editor restored.");return;}
        if(mode==AR&&(!tracking||anchor==null)){listener.notice("Place the origin while tracking before playing.");return;}
        gameOrder.clear();for(SceneData.Entity e:scene)if(e.type.equals("start"))gameOrder.add(e.id);
        if(gameOrder.size()!=1){listener.notice("Place exactly one Start and one Goal, plus optional Checkpoints.");return;}
        for(SceneData.Entity e:scene)if(e.type.equals("checkpoint"))gameOrder.add(e.id);
        int goals=0;for(SceneData.Entity e:scene)if(e.type.equals("goal")){gameOrder.add(e.id);goals++;}
        if(goals!=1){listener.notice("Place exactly one Goal.");return;}playing=true;gameStep=0;selected=null;listener.notice("Tap Start, then checkpoints in creation order, then Goal.");
    }
    private void gameTap(){if(gameStep>=gameOrder.size())return;String id=pick(touchX,touchY);if(gameOrder.get(gameStep).equals(id)){gameStep++;listener.notice(gameStep==gameOrder.size()?"Map complete! Tap Play to return to editing.":"Good! Find the next marker.");}else listener.notice("Find "+(gameStep==0?"the green Start":gameStep==gameOrder.size()-1?"the orange Goal":"the next purple Checkpoint"));}
    void resetView(){yaw=0;pitch=0;eye[0]=0;eye[1]=1.4f;eye[2]=3;synchronized(this){rotation=null;}}
    void moveView(float amount){if(mode!=STUDIO)return;double a=Math.toRadians(yaw);eye[0]-=(float)Math.sin(a)*amount;eye[2]-=(float)Math.cos(a)*amount;}
    void detachSession(){finishStroke();if(anchor!=null){anchor.detach();anchor=null;}frame=null;originTool=false;renderFailed=false;down=false;hold=false;pendingTap=false;playing=false;Matrix.setIdentityM(root,0);Matrix.setIdentityM(inverseRoot,0);}
    List<SceneData.Entity> snapshot(){finishStroke();return new ArrayList<>(scene);}
    void replace(List<SceneData.Entity> entities,Map<String,Bitmap> images){
        finishStroke();for(Resource resource:resources.values())resource.dispose();resources.clear();
        for(int texture:textures.values())GLES20.glDeleteTextures(1,new int[]{texture},0);textures.clear();
        for(Bitmap bitmap:bitmaps.values())bitmap.recycle();bitmaps.clear();bitmaps.putAll(images);
        scene.clear();scene.addAll(entities);undo.clear();redo.clear();born.clear();selected=null;activePaperId="";playing=false;gameStep=-1;
        if(anchor!=null){anchor.detach();anchor=null;}resetView();listener.notice(mode==AR?"Project loaded. Set origin again to align it in this room.":"Project loaded. Use Look to inspect it.");
    }
}
