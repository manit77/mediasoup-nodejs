global.console = {
  ...console,
  log: jest.fn((...params) => {

    let str = "";
    for (var p of params) {
      str += p + " ";
    }
    process.stdout.write(`${str}\n`);
    
  }),
};