const path=require('node:path');
module.exports={
  testDir:path.resolve(__dirname,'../STUDYante-App/tests/browser'),timeout:45000,workers:1,
  outputDir:path.resolve(__dirname,'../STUDYante-App/test-results/phase5-existing'),
  use:{baseURL:'http://127.0.0.1:4174',browserName:'chromium',channel:'msedge',headless:true,screenshot:'off',trace:'off',launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}},
  webServer:{command:'node migration-audit/serve-render-frontend.cjs',cwd:path.resolve(__dirname,'..'),url:'http://127.0.0.1:4174',reuseExistingServer:false},
};
