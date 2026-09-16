package com.drawin3d;

/** Right-handed, Y-up geometry in metres. No sensor position integration. */
final class Math3 {
    private Math3() {}
    static float[] add(float[] a, float[] b) { return new float[]{a[0]+b[0],a[1]+b[1],a[2]+b[2]}; }
    static float[] sub(float[] a, float[] b) { return new float[]{a[0]-b[0],a[1]-b[1],a[2]-b[2]}; }
    static float[] mul(float[] a, float s) { return new float[]{a[0]*s,a[1]*s,a[2]*s}; }
    static float dot(float[] a,float[] b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
    static float length(float[] a) { return (float)Math.sqrt(dot(a,a)); }
    static float distance(float[] a,float[] b) { return length(sub(a,b)); }
    static float[] norm(float[] a) { float n=length(a); return n<1e-6f?new float[]{0,1,0}:mul(a,1/n); }
    static float[] cross(float[] a,float[] b) { return new float[]{a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]}; }
    static float clamp(float v,float min,float max) { return Math.max(min,Math.min(max,v)); }
    static float[] curve(float u,float width,float radians) {
        if(Math.abs(radians)<0.0001f) return new float[]{(u-.5f)*width,0,0};
        float r=width/radians, t=(u-.5f)*radians;
        return new float[]{r*(float)Math.sin(t),0,r*(1-(float)Math.cos(t))};
    }
    static float[] tangentGravity(float[] normal) {
        float[] g={0,-1,0}; return sub(g,mul(normal,dot(g,normal)));
    }
    static float[] planeHit(float[] origin,float[] direction,float[] point,float[] normal) {
        float d=dot(direction,normal);
        if(Math.abs(d)<.02f) return null;
        float t=dot(sub(point,origin),normal)/d;
        return t>.05f && t<8?add(origin,mul(direction,t)):null;
    }
    static float[] rotateY(float[] p,float degrees) {
        double a=Math.toRadians(degrees); float c=(float)Math.cos(a),s=(float)Math.sin(a);
        return new float[]{c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]};
    }
}
