import { Plants, Stocks, StocksRepository } from '@actoolkit/domain';

import { OverlayComponentFactory } from '../../shared';
import { LandSeedPlantsModel } from '../models/land-seed-plants.model';

export async function stockValueFeature(): Promise<void> {
    const lsp: LandSeedPlantsModel = LandSeedPlantsModel.ForCurrentPage();

    const stocks: Stocks = await new StocksRepository().get();
    const plantedSeeds: Plants = stocks.seeds.plants();

    lsp.getSeeds().appendChild(OverlayComponentFactory('Value', `
        Sold: ${stocks.seeds.sold().toString()}</br>
        Planted: ${plantedSeeds.sold().toString()}</br>
        Gardeners required: ${stocks.seeds.gardeners().toLocaleString('en')}
    `));

    lsp.getPlants().appendChild(OverlayComponentFactory('Value', `
        Sold: ${stocks.plants.sold().toString()}</br>
    `));
}
