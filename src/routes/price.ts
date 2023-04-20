import {fetchReefPrice, Price} from "../services/utils";
import {NextFunction, Response} from 'express';

const CACHE_PRICE_MS = 30000;
let currentPrice:{timestamp: number, price?: Price}={timestamp:0}

export const getReefPrice = async (_, res: Response, next: NextFunction) => {
    const now = (new Date()).getTime();

    if (now - currentPrice.timestamp > CACHE_PRICE_MS) {
        try {
            const price = await fetchReefPrice();
            currentPrice = {timestamp: (new Date()).getTime(), price};
        } catch (err) {
            next(err);
        }
    }
    res.send({...currentPrice.price, timestamp: currentPrice.timestamp});

}
export const getVersion = async (_, res: Response, next: NextFunction) => {
    res.send({version: process.env.npm_package_version, timestamp: (new Date()).getTime()});
}
