exports.handler = async function(event, context) {
  console.log('Monitor function ran at: ' + new Date().toISOString());
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Monitor is alive!', time: new Date().toISOString() })
  };
};
