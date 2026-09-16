package com.drawin3d;

import java.util.ArrayList;
import java.util.List;

/** Baked authoring operations matching web/src/stroke-processing.js. */
final class StrokeProcessing {
    private static float[] lerp(float[] a,float[] b,double t){float[] p=new float[4];for(int j=0;j<4;j++)p[j]=(float)(a[j]+(b[j]-a[j])*t);return p;}
    private static double distance(float[] a,float[] b){double x=(double)a[0]-b[0],y=(double)a[1]-b[1],z=(double)a[2]-b[2];return Math.sqrt(x*x+y*y+z*z);}
    private static ArrayList<float[]> copy(List<float[]> points){ArrayList<float[]> out=new ArrayList<>();for(float[] p:points)out.add(p.clone());return out;}
    private static ArrayList<float[]> resample(List<float[]> points,int count){
        double[] lengths=new double[points.size()];for(int i=1;i<points.size();i++)lengths[i]=lengths[i-1]+distance(points.get(i-1),points.get(i));
        double total=lengths[lengths.length-1];int segment=1;ArrayList<float[]> result=new ArrayList<>();
        for(int i=0;i<count;i++){if(total<1e-9){result.add(points.get(0).clone());continue;}double at=total*i/(count-1);while(segment<points.size()-1&&lengths[segment]<at)segment++;double length=lengths[segment]-lengths[segment-1];result.add(lerp(points.get(segment-1),points.get(segment),length>1e-9?(at-lengths[segment-1])/length:0));}return result;
    }
    static ArrayList<float[]> smooth(List<float[]> points,float strength,int maxPoints){
        if(points.size()<3||strength<=0)return copy(points);
        boolean closed=distance(points.get(0),points.get(points.size()-1))<1e-6;double amount=Math3.clamp(strength,0,1),length=0;
        for(int i=1;i<points.size();i++)length+=distance(points.get(i-1),points.get(i));if(length<1e-8)return copy(points);
        int count=Math.max(3,Math.min(Math.min(384,maxPoints),Math.max(points.size(),Math.min(128,(int)Math.ceil(length/.015)+1))));
        ArrayList<float[]> rounded=copy(points);
        for(int pass=0;pass<3;pass++){
            ArrayList<float[]> next=new ArrayList<>();if(!closed)next.add(rounded.get(0).clone());
            for(int i=0;i<rounded.size()-1;i++){next.add(lerp(rounded.get(i),rounded.get(i+1),.25));next.add(lerp(rounded.get(i),rounded.get(i+1),.75));}
            next.add((closed?next.get(0):rounded.get(rounded.size()-1)).clone());rounded=next;
        }
        ArrayList<float[]> original=resample(points,count),soft=resample(rounded,count),result=new ArrayList<>();for(int i=0;i<count;i++)result.add(lerp(original.get(i),soft.get(i),amount));
        if(closed)result.set(count-1,result.get(0).clone());else{result.set(0,points.get(0).clone());result.set(count-1,points.get(points.size()-1).clone());}return result;
    }
    static ArrayList<float[]> curve(float[] delta,float[] normal,float bend,boolean sCurve,int count,float firstPressure,float lastPressure){
        ArrayList<float[]> result=new ArrayList<>();float length=Math3.length(delta);if(length<1e-8f){result.add(new float[]{0,0,0,firstPressure});return result;}
        float[] cross=Math3.cross(normal,delta);float n=Math3.length(cross);float[] offset=n>1e-8f?Math3.mul(cross,length*Math3.clamp(bend,-1,1)/n):new float[3];count=Math.max(3,Math.min(65,count));
        for(int i=0;i<count;i++){double t=i/(double)(count-1),u=1-t;float[] p=new float[4];for(int j=0;j<3;j++)p[j]=(float)(delta[j]*t+(sCurve?3*u*t*(u-t):2*u*t)*offset[j]);p[3]=(float)(firstPressure+(lastPressure-firstPressure)*t);result.add(p);}return result;
    }
}
