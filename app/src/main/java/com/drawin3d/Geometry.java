package com.drawin3d;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.Random;

/** Vertex layout: position xyz, colour rgba, uv, drip displacement xyz. */
final class Geometry {
    static final int STRIDE=12;
    private float[] values=new float[8192]; private int size;
    void vertex(float[] p,float[] c,float u,float v,float[] fall){
        if(size+STRIDE>values.length)values=java.util.Arrays.copyOf(values,values.length*2);
        for(int i=0;i<3;i++)values[size++]=p[i];for(float n:c)values[size++]=n;
        values[size++]=u;values[size++]=v;for(float n:fall)values[size++]=n;
    }
    private void tri(float[] a,float[] b,float[] c,float[] color){float[] zero={0,0,0};vertex(a,color,0,0,zero);vertex(b,color,0,0,zero);vertex(c,color,0,0,zero);}
    FloatBuffer buffer(){FloatBuffer b=ByteBuffer.allocateDirect(size*4).order(ByteOrder.nativeOrder()).asFloatBuffer();b.put(values,0,size).position(0);return b;}
    int count(){return size/STRIDE;}
    static float[] color(int argb,float alpha){return new float[]{((argb>>16)&255)/255f,((argb>>8)&255)/255f,(argb&255)/255f,alpha};}
    private void tube(float[] a,float[] b,float radius,float[] color,int sides){
        float[] dir=Math3.sub(b,a);if(Math3.length(dir)<.00001f)return;dir=Math3.norm(dir);
        float[] side=Math3.norm(Math3.cross(dir,Math.abs(dir[1])>.9f?new float[]{1,0,0}:new float[]{0,1,0}));
        float[] up=Math3.cross(dir,side);
        for(int j=0;j<sides;j++){
            float t=(float)(j*Math.PI*2/sides),s=(float)((j+1)*Math.PI*2/sides);
            float[] d1=Math3.add(Math3.mul(side,(float)Math.cos(t)*radius),Math3.mul(up,(float)Math.sin(t)*radius));
            float[] d2=Math3.add(Math3.mul(side,(float)Math.cos(s)*radius),Math3.mul(up,(float)Math.sin(s)*radius));
            float[] a1=Math3.add(a,d1),a2=Math3.add(a,d2),b1=Math3.add(b,d1),b2=Math3.add(b,d2);
            tri(a1,b1,a2,color);tri(a2,b1,b2,color);
        }
    }
    private void dot(float[] p,float r,float[] color){
        float[] top=Math3.add(p,new float[]{0,r,0}),bottom=Math3.add(p,new float[]{0,-r,0});
        float[][] ring={{r,0,0},{0,0,r},{-r,0,0},{0,0,-r}};
        for(int j=0;j<4;j++){tri(top,Math3.add(p,ring[j]),Math3.add(p,ring[(j+1)%4]),color);tri(bottom,Math3.add(p,ring[(j+1)%4]),Math3.add(p,ring[j]),color);}
    }
    static Geometry stroke(SceneData.Entity e){
        Geometry m=new Geometry();float alpha=e.alpha;
        if(e.brush.equals("Marker"))alpha*=.55f;if(e.brush.equals("Water"))alpha*=.6f;
        boolean spray=e.brush.equals("Spray"),neon=e.brush.equals("Neon");
        float[] c=color(e.color,neon?alpha*.3f:alpha);
        Random rng=new Random(e.id.hashCode());
        ArrayList<ArrayList<float[]>> paths=StrokePaths.of(e);ArrayList<float[]> visible=new ArrayList<>();for(ArrayList<float[]> path:paths)visible.addAll(path);
        for(ArrayList<float[]> path:paths)for(int i=0;i<path.size();i++){
            float[] p=path.get(i);float radius=e.width*.5f*p[3];
            if(spray){for(int j=0;j<3;j++){float[] off={(rng.nextFloat()-.5f)*e.width*3,(rng.nextFloat()-.5f)*e.width*3,(rng.nextFloat()-.5f)*e.width};m.dot(Math3.add(p,off),radius*.18f,c);}}
            else if(i>0){
                float[] a=path.get(i-1);m.tube(a,p,radius*(e.brush.equals("Marker")?1.8f:1),c,6);
                if(neon)m.tube(a,p,radius*.35f,new float[]{.95f,1,1,alpha},4);
            }else m.dot(p,radius,c);
        }
        if(e.wet&&!e.points.isEmpty()){
            float[] gravity=e.surface?Math3.tangentGravity(e.normal):new float[]{0,-1,0};
            float speed=Math3.length(gravity);
            if(speed>.05f){
                gravity=Math3.norm(gravity);float[] side=Math3.norm(Math3.cross(gravity,e.normal));
                int count=Math.min(8,Math.max(1,visible.size()/10));
                for(int j=0;j<count;j++){
                    float[] p=visible.get(j*(visible.size()-1)/Math.max(1,count-1));float w=e.width*(.12f+rng.nextFloat()*.2f);
                    float[] left=Math3.add(p,Math3.mul(side,-w)),right=Math3.add(p,Math3.mul(side,w));
                    float[] fall=Math3.mul(gravity,Math.min(.3f,.08f+rng.nextFloat()*.22f)*speed),zero={0,0,0};
                    m.vertex(left,c,0,0,zero);m.vertex(right,c,0,0,zero);m.vertex(left,c,0,0,fall);
                    m.vertex(right,c,0,0,zero);m.vertex(right,c,0,0,fall);m.vertex(left,c,0,0,fall);
                }
            }
        }
        return m;
    }
    static Geometry image(SceneData.Entity e){
        Geometry m=new Geometry();int steps=Math.max(1,(int)(e.arc/5));float h=e.panelWidth/e.aspect;
        float[] c={1,1,1,e.alpha},zero={0,0,0};
        for(int i=0;i<steps;i++){
            float u=i/(float)steps,v=(i+1)/(float)steps;
            float[] a=Math3.curve(u,e.panelWidth,(float)Math.toRadians(e.arc)),b=Math3.curve(v,e.panelWidth,(float)Math.toRadians(e.arc));
            float[] at={a[0],h/2,a[2]},ab={a[0],-h/2,a[2]},bt={b[0],h/2,b[2]},bb={b[0],-h/2,b[2]};
            m.vertex(at,c,u,0,zero);m.vertex(ab,c,u,1,zero);m.vertex(bt,c,v,0,zero);
            m.vertex(bt,c,v,0,zero);m.vertex(ab,c,u,1,zero);m.vertex(bb,c,v,1,zero);
        }
        return m;
    }
    static Geometry block(SceneData.Entity e){
        Geometry m=new Geometry();float x=e.size[0]/2,y=e.size[1]/2,z=e.size[2]/2;
        float[][] corners={{-x,-y,-z},{x,-y,-z},{x,y,-z},{-x,y,-z},{-x,-y,z},{x,-y,z},{x,y,z},{-x,y,z}};
        int[][] faces={{0,1,2,3},{5,4,7,6},{4,0,3,7},{1,5,6,2},{3,2,6,7},{4,5,1,0}};float[] shades={.7f,1,.76f,.87f,1.1f,.55f};
        for(int i=0;i<6;i++){int[] f=faces[i];float[] c=color(e.color,e.alpha);for(int j=0;j<3;j++)c[j]=Math.min(1,c[j]*shades[i]);m.tri(corners[f[0]],corners[f[1]],corners[f[2]],c);m.tri(corners[f[0]],corners[f[2]],corners[f[3]],c);}return m;
    }
    static Geometry marker(SceneData.Entity e){
        Geometry m=new Geometry();float[] c=color(e.color,1);
        for(int i=0;i<32;i++){
            float a=(float)(i*Math.PI/16),b=(float)((i+1)*Math.PI/16);
            m.tube(new float[]{.16f*(float)Math.cos(a),.16f*(float)Math.sin(a),0},new float[]{.16f*(float)Math.cos(b),.16f*(float)Math.sin(b),0},.018f,c,4);
        }
        if(e.type.equals("start"))m.tri(new float[]{-.05f,-.075f,0},new float[]{.085f,0,0},new float[]{-.05f,.075f,0},c);
        if(e.type.equals("goal")){m.tube(new float[]{-.07f,-.07f,0},new float[]{.07f,.07f,0},.013f,c,4);m.tube(new float[]{-.07f,.07f,0},new float[]{.07f,-.07f,0},.013f,c,4);}
        return m;
    }
    static Geometry grid(){
        Geometry m=new Geometry();float[] c={.13f,.23f,.28f,1};
        for(int i=-8;i<=8;i++){float v=i*.5f;m.tube(new float[]{v,0,-4},new float[]{v,0,4},.003f,c,3);m.tube(new float[]{-4,0,v},new float[]{4,0,v},.003f,c,3);}return m;
    }
    static Geometry origin(){
        Geometry m=new Geometry();float[] zero={0,0,0};m.tube(zero,new float[]{.25f,0,0},.005f,new float[]{1,.4f,.4f,1},4);
        m.tube(zero,new float[]{0,.25f,0},.005f,new float[]{.4f,1,.6f,1},4);m.tube(zero,new float[]{0,0,-.25f},.005f,new float[]{.4f,.7f,1,1},4);return m;
    }
}
