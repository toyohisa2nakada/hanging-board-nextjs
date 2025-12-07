import { NextRequest, NextResponse } from 'next/server';
import * as osc from 'osc';
const OBSBOT_PORT = 16284;
const port = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 57121,
    remoteAddress: "127.0.0.1",
    remotePort: OBSBOT_PORT
});
port.open();
console.log("osc port opened")

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // console.log(body);
        const degree = -body.angle * 180 / Math.PI;
        console.log(degree)
        port.send({
            address: "/OBSBOT/WebCam/General/SetGimMotorDegreeEx",
            args: [
                { type: "i", value: 0 },    // device no
                { type: "f", value: 90.0 }, // speed (0~90)
                { type: "f", value: 0.0 }, // pan degree (-129~129)
                { type: "f", value: degree }, // pitch degree (-59~59)
            ]
        })

        return NextResponse.json({}, { status: 200 });
    } catch (error) {
        return NextResponse.json(
            { error: "サーバー側で予期せぬエラーが発生しました" },
            { status: 500 }
        );
    }
}
