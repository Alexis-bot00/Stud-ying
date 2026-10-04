const path=require('node:path'),cp=require('node:child_process');
const config=require('./frontend-render-test.json'),root=path.resolve(__dirname,'..'),app=path.join(root,'STUDYante-App');
if(config.EXPO_PUBLIC_API_URL!=='https://studyante-backend-test.onrender.com')throw Error('Unexpected test backend');
const child=cp.spawn(process.execPath,[path.join(app,'node_modules/expo/bin/cli'),'export','--platform','web','--output-dir',config.outputDirectory,'--clear'],{cwd:app,stdio:'inherit',env:{...process.env,CI:'1',EXPO_NO_DOTENV:'1',EXPO_NO_CLIENT_ENV_VARS:'0',EXPO_PUBLIC_API_URL:config.EXPO_PUBLIC_API_URL}});
child.on('exit',code=>{process.exitCode=code||0;});
