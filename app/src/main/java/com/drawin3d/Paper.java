package com.drawin3d;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Random;

/** Procedural sheets and surface paint. No camera, simulation loop or bitmap files. */
final class Paper {
    static final String[] KINDS={"watercolor","rough","sketch","canvas","coated"};
    static final String[] NAMES={"Watercolor · cold press","Watercolor · rough","Sketch paper","Woven canvas","Coated · water resistant"};
    static final int[] TINT={0xfff1e6d1,0xffe9dcc3,0xfff5eedf,0xffe7d8b8,0xffe4edf0};
    static final float[] SPREAD={1.35f,1.6f,1,1.08f,.92f},OPACITY={.72f,.64f,.95f,.9f,.94f},GRAIN={.55f,.85f,.22f,.6f,.08f};
    static int kind(String name){return Arrays.asList(KINDS).indexOf(name);}
    static float[][] basis(float[] normal){
        float[] n=Math3.norm(normal),u=Math3.norm(Math3.cross(Math.abs(n[1])>.95f?new float[]{0,0,-1}:new float[]{0,1,0},n));
        return new float[][]{u,Math3.cross(n,u),n};
    }
    static float[] world(SceneData.Entity e,float[] p){return Math3.add(e.position,Math3.rotateY(Math3.mul(p,e.scale),e.yaw));}
    static float[] coordinates(SceneData.Entity e,float[] world){
        float[] p=Math3.mul(Math3.rotateY(Math3.sub(world,e.position),-e.yaw),1/e.scale);float[][] axes=basis(e.normal);
        return new float[]{Math3.dot(p,axes[0]),Math3.dot(p,axes[1]),Math3.dot(p,axes[2])};
    }
    static boolean inside(SceneData.Entity e,float[] p){float[] uv=coordinates(e,p);return Math.abs(uv[0])<=e.panelWidth/2&&Math.abs(uv[1])<=e.panelWidth/e.aspect/2;}
    static int[] pixels(String kind,boolean ink){
        int k=kind(kind);int[] pixels=new int[256*256];
        for(int y=0;y<256;y++)for(int x=0;x<256;x++){
            int h=(x*374761393)^(y*668265263);h=(h^(h>>>13))*1274126177;h^=h>>>16;
            double n=(h&0xffffffffL)/4294967295.0;
            if(k==3)n=Math.min(1,n*.3+(x%8<2||y%8<2?.1:.7));
            if(k==2)n=.55+n*.35+(y%17==0?-.25:0);if(k==4)n=.88+n*.12;
            double shade=1-GRAIN[k]*(1-n)*.2;
            int r=ink?255:(int)Math.round(((TINT[k]>>16)&255)*shade),g=ink?255:(int)Math.round(((TINT[k]>>8)&255)*shade),b=ink?255:(int)Math.round((TINT[k]&255)*shade);
            int a=ink?(int)Math.round(255*(1-GRAIN[k]*(1-n)*.85)):255;pixels[y*256+x]=(a<<24)|(r<<16)|(g<<8)|b;
        }return pixels;
    }
    static Geometry sheet(SceneData.Entity e){
        Geometry m=new Geometry();float[][] axes=basis(e.normal);float w=e.panelWidth/2,h=w/e.aspect;float[] c={1,1,1,1},zero={0,0,0};
        for(int[] p:new int[][]{{-1,1},{-1,-1},{1,1},{1,1},{-1,-1},{1,-1}})m.vertex(Math3.add(Math3.mul(axes[0],p[0]*w),Math3.mul(axes[1],p[1]*h)),c,(p[0]+1)/2f,(1-p[1])/2f,zero);return m;
    }
    static Geometry ink(SceneData.Entity e,SceneData.Entity paper){return new Ink(e,paper).build();}
    private static final class Ink {
        final Geometry m=new Geometry();final SceneData.Entity e,paper;final float[][] axes;final float[] color;final int kind;final boolean wash;final Random rng;
        Ink(SceneData.Entity e,SceneData.Entity paper){this.e=e;this.paper=paper;axes=basis(paper.normal);kind=kind(paper.paperKind);wash=e.brush.equals("Water")||e.wet;rng=new Random(e.id.hashCode());color=Geometry.color(e.color,e.alpha*(wash?OPACITY[kind]:1)*(e.brush.equals("Marker")?.55f:1));}
        void vertex(float[] p,float alpha,float[] fall){
            float[] local=Math3.add(Math3.add(Math3.mul(axes[0],p[0]),Math3.mul(axes[1],p[1])),Math3.mul(axes[2],.003f/paper.scale));
            float[] ep=Math3.mul(Math3.rotateY(Math3.sub(world(paper,local),e.position),-e.yaw),1/e.scale);
            float[] fd=Math3.mul(Math3.rotateY(Math3.rotateY(Math3.add(Math3.mul(axes[0],fall[0]),Math3.mul(axes[1],fall[1])),paper.yaw),-e.yaw),paper.scale/e.scale);
            m.vertex(ep,new float[]{color[0],color[1],color[2],color[3]*alpha},.5f+(p[0]+fall[0])/paper.panelWidth,.5f-(p[1]+fall[1])/(paper.panelWidth/paper.aspect),fd);
        }
        void ribbon(float[] a,float[] b,float r,float[] fall){
            float dx=b[0]-a[0]+fall[0],dy=b[1]-a[1]+fall[1],length=(float)Math.hypot(dx,dy);if(length<1e-8f)return;
            float sx=-dy/length*r,sy=dx/length*r;float[] stops=wash?new float[]{-1,-.65f,.65f,1}:new float[]{-1,-.9f,.9f,1},opacity={0,1,1,0},zero={0,0};
            for(int i=0;i<3;i++){
                float[] a0={a[0]+sx*stops[i],a[1]+sy*stops[i]},a1={a[0]+sx*stops[i+1],a[1]+sy*stops[i+1]},b0={b[0]+sx*stops[i],b[1]+sy*stops[i]},b1={b[0]+sx*stops[i+1],b[1]+sy*stops[i+1]};
                vertex(a0,opacity[i],zero);vertex(b0,opacity[i],fall);vertex(a1,opacity[i+1],zero);vertex(a1,opacity[i+1],zero);vertex(b0,opacity[i],fall);vertex(b1,opacity[i+1],fall);
            }
        }
        void stamp(float[] p,float r){float[] zero={0,0};for(int j=0;j<12;j++){double a=j*Math.PI/6,b=(j+1)*Math.PI/6;vertex(p,1,zero);vertex(new float[]{p[0]+(float)Math.cos(a)*r,p[1]+(float)Math.sin(a)*r},0,zero);vertex(new float[]{p[0]+(float)Math.cos(b)*r,p[1]+(float)Math.sin(b)*r},0,zero);}}
        Geometry build(){
            ArrayList<float[]> all=new ArrayList<>();float[] zero={0,0};
            for(ArrayList<float[]> original:StrokePaths.of(e)){
                ArrayList<float[]> path=new ArrayList<>();for(float[] p:original){float[] uv=coordinates(paper,world(e,p));path.add(new float[]{uv[0],uv[1],p[3]});}all.addAll(path);
                for(int i=0;i<path.size();i++){float[] p=path.get(i);float r=e.width*.5f*p[2]*e.scale/paper.scale*(wash?SPREAD[kind]:1)*(e.brush.equals("Marker")?1.8f:1);
                    if(e.brush.equals("Spray")){for(int j=0;j<3;j++)stamp(new float[]{p[0]+(rng.nextFloat()-.5f)*r*5,p[1]+(rng.nextFloat()-.5f)*r*5},r*.4f);}
                    else if(i>0)ribbon(path.get(i-1),p,r,zero);else stamp(p,r);
                    if(i==path.size()-1&&path.size()>1&&!e.brush.equals("Spray"))stamp(p,r);
                }
            }
            if(e.wet&&kind==4&&!all.isEmpty()){
                float[] gravity=Math3.rotateY(new float[]{0,-1,0},-paper.yaw);float gx=Math3.dot(gravity,axes[0]),gy=Math3.dot(gravity,axes[1]);int count=Math.min(8,Math.max(1,all.size()/10));
                if(Math.hypot(gx,gy)>.05)for(int i=0;i<count;i++){float[] p=all.get(i*(all.size()-1)/Math.max(1,count-1));float length=(.08f+rng.nextFloat()*.22f)/paper.scale;ribbon(p,p,e.width*(.12f+rng.nextFloat()*.2f)*e.scale/paper.scale,new float[]{gx*length,gy*length});}
            }return m;
        }
    }
}
