package com.drawin3d;

import org.junit.Test;
import static org.junit.Assert.*;

/** Look/gyro and Studio camera math. android.opengl.Matrix conventions (column-major) are re-derived by hand. */
public class ViewMathTest {
    // SensorManager.getRotationMatrixFromVector fills a 16-element array ROW-major.
    private static float[] sensor(double[][] m){float[] a=new float[16];for(int r=0;r<3;r++)for(int c=0;c<3;c++)a[r*4+c]=(float)m[r][c];a[15]=1;return a;}
    private static double[][] mul(double[][] a,double[][] b){double[][] o=new double[3][3];for(int r=0;r<3;r++)for(int c=0;c<3;c++)for(int k=0;k<3;k++)o[r][c]+=a[r][k]*b[k][c];return o;}
    private static float[] apply(float[] columnMajor,float[] v){float[] o=new float[3];for(int r=0;r<3;r++)for(int c=0;c<3;c++)o[r]+=columnMajor[c*4+r]*v[c];return o;}
    // Upright portrait facing north: device x->east, y->up, z (out of the screen)->south. Sensor world: x east, y north, z up.
    private static final double[][] UPRIGHT={{1,0,0},{0,0,-1},{0,1,0}};
    private static double[][] aboutWorldUp(double deg){double a=Math.toRadians(deg),c=Math.cos(a),s=Math.sin(a);return new double[][]{{c,-s,0},{s,c,0},{0,0,1}};}
    private static double[][] aboutDeviceX(double deg){double a=Math.toRadians(deg),c=Math.cos(a),s=Math.sin(a);return new double[][]{{1,0,0},{0,c,-s},{0,s,c}};}

    @Test public void lookViewStartsAtIdentity(){
        float[] start=sensor(UPRIGHT),view=Math3.relativeRotation(start,start);
        for(int i=0;i<16;i++)assertEquals(i%5==0?1:0,view[i],1e-6f);
    }
    @Test public void turningLeftYawsTheSceneRightWithoutRoll(){
        float[] view=Math3.relativeRotation(sensor(mul(aboutWorldUp(30),UPRIGHT)),sensor(UPRIGHT));
        assertArrayEquals(new float[]{.5f,0,-.866f},apply(view,new float[]{0,0,-1}),1e-3f); // what was ahead is now to the right
        assertArrayEquals(new float[]{0,1,0},apply(view,new float[]{0,1,0}),1e-3f);         // up stays up: a yaw, not a roll
    }
    @Test public void tiltingUpMovesTheSceneDown(){
        float[] ahead=apply(Math3.relativeRotation(sensor(mul(UPRIGHT,aboutDeviceX(20))),sensor(UPRIGHT)),new float[]{0,0,-1});
        assertArrayEquals(new float[]{0,-.342f,-.940f},ahead,1e-3f);
    }
    @Test public void studioForwardMatchesTheViewRotation(){
        for(float yaw:new float[]{0,90,-45,200}){
            float[] f=Math3.studioForward(yaw);double a=Math.toRadians(yaw),c=Math.cos(a),s=Math.sin(a);
            // Matrix.rotateM(view,0,yaw,0,1,0): x'=c*x+s*z, z'=-s*x+c*z. "Forward" must land on camera -Z and stay level.
            assertEquals(0,c*f[0]+s*f[2],1e-5);assertEquals(-1,-s*f[0]+c*f[2],1e-5);assertEquals(0,f[1],0);
        }
        assertArrayEquals(new float[]{1,0,0},Math3.studioForward(90),1e-6f);
    }
}
