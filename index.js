const { program } = require('commander');
const GladlyImporter = require('./lib/importer');
const { loadConfig } = require('./lib/config');
const logger = require('./lib/logger');

program
  .name('gladly-enterpret-import')
  .description('Import conversation data from Gladly into Enterpret')
  .version('1.0.0')
  .option('-i, --incremental', 'Only import new data since last import (default)', true)
  .option('-f, --full', 'Perform a full import of all available data')
  .option('-s, --start-date <date>', 'Start date for import (ISO 8601 format)')
  .option('-e, --end-date <date>', 'End date for import (ISO 8601 format)')
  .option('-l, --limit <number>', 'Maximum number of conversations to import')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-c, --config <path>', 'Path to config file', './config.json');

program.parse();
const options = program.opts();

async function main() {
  try {
    if (options.verbose) {
      logger.setLevel('debug');
    }

    logger.info('Starting Gladly to Enterpret import');
    
    const config = await loadConfig(options.config);
    
    // Override config with CLI options if provided
    if (options.startDate) config.startDate = options.startDate;
    if (options.endDate) config.endDate = options.endDate;
    if (options.limit) config.limit = parseInt(options.limit, 10);
    
    // Determine if this is a full or incremental import
    const isFullImport = options.full === true;
    
    // Initialize and run the importer
    const importer = new GladlyImporter(config);
    const result = await importer.import({
      isFullImport,
      startDate: config.startDate,
      endDate: config.endDate,
      limit: config.limit
    });
    
    logger.info(`Import completed successfully. Imported ${result.conversationsCount} conversations with ${result.itemsCount} items.`);
    process.exit(0);
  } catch (error) {
    logger.error(`Import failed: ${error.message}`);
    if (options.verbose) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

main();