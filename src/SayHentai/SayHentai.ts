import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    TagType,
    TagSection,
    ContentRating,
    RequestHeaders,
    MangaTile,
    Tag,
    LanguageCode,
} from "paperback-extensions-common"
import { parseSearch, isLastPage, parseViewMore } from "./SayHentaiParser"

const DOMAIN = 'https://truyentranhlh.net/'
const method = 'GET'

export const SayHentaiInfo: SourceInfo = {
    version: '2.0.0',
    name: 'SayHentai',
    icon: 'icon.png',
    author: 'Huynhzip3',
    authorWebsite: 'https://github.com/huynh12345678',
    description: 'Extension that pulls manga from SayHentai',
    websiteBaseURL: `https://sayhentai.net/`,
    contentRating: ContentRating.ADULT,
    sourceTags: [
        {
            text: "18+",
            type: TagType.YELLOW
        }
    ]
}

export class SayHentai extends Source {
    getMangaShareUrl(mangaId: string): string { return `https://sayhentai.net/${mangaId}` };
    requestManager = createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000
    })

    async getMangaDetails(mangaId: string): Promise<Manga> {
        const url = `https://sayhentai.net/${mangaId}`;
        const request = createRequestObject({
            url: url,
            method: "GET",
        });
        const data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        let tags: Tag[] = [];
        let creator = '';
        let status = 1; //completed, 1 = Ongoing
        let desc = $('.detail-content > p').text();
        for (const t of $('.list01.li03 > a.genner-block').toArray()) {
            const genre = $(t).text().trim()
            const id = $(t).attr('href') ?? genre
            tags.push(createTag({ label: genre, id }));
        }
        creator = $('.list-info > li:nth-child(1)').text().split(":")[1].trim();
        status = $('.list-info > li:nth-child(2) > b').text().toLowerCase().includes("đang") ? 1 : 0;
        const image = $('.wrap-content-image > img').attr('src');
        return createManga({
            id: mangaId,
            author: creator,
            artist: creator,
            desc: desc,
            titles: [$('.wrap-content-info > h1').text().trim()],
            image: image?.includes('http') ? image : (image?.includes('//') ? ('https:' + image.replace('//st.truyenchon.com', '//st.imageinstant.net')) : ('https://sayhentai.net/' + image)),
            status,
            // rating: parseFloat($('span[itemprop="ratingValue"]').text()),
            hentai: true,
            tags: [createTagSection({ label: "genres", tags: tags, id: '0' })]
        });

    }
    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `https://sayhentai.net/${mangaId}`,
            method,
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const chapters: Chapter[] = [];
        var i = 0;
        for (const obj of $("#list-chapter > li.chap-item").toArray().reverse()) {
            var chapNum = parseFloat($('a', obj).text().trim().split(' ')[1]);
            i++;
            chapters.push(createChapter(<Chapter>{
                id: $('a', obj).first().attr('href'),
                chapNum: isNaN(chapNum) ? i : chapNum,
                name: $('span', obj).text().trim(),
                mangaId: mangaId,
                langCode: LanguageCode.VIETNAMESE,
            }));
        }

        return chapters;
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: `https://sayhentai.net/${chapterId}`,
            method
        });

        const response = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(response.data);
        const pages: string[] = [];
        for (let obj of $('#lst_content > img').toArray()) {
            if (!obj.attribs['data-src']) continue;
            let link = obj.attribs['data-src'].includes('http') ?
                (obj.attribs['data-src']).trim() : ('https://sayhentai.net/' + obj.attribs['data-src']).trim();
            pages.push(link);
        }

        const chapterDetails = createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages,
            longStrip: false
        });
        return chapterDetails;
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        let hot: HomeSection = createHomeSection({
            id: 'hot',
            title: "Top Trong Ngày",
            view_more: true,
        });
        let newUpdated: HomeSection = createHomeSection({
            id: 'new_updated',
            title: "Mới Cập Nhật",
            view_more: true,
        });
        let newAdded: HomeSection = createHomeSection({
            id: 'new_added',
            title: "Truyện Mới",
            view_more: true,
        });

        //Load empty sections
        sectionCallback(hot);
        sectionCallback(newUpdated);
        sectionCallback(newAdded);

        ///Get the section data
        //Hot
        let url = '';
        let request = createRequestObject({
            url: 'https://sayhentai.net/',
            method: "GET",
        });
        let hotItems: MangaTile[] = [];
        let data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        for (let obj of $('li', '#main-content > .wrap-content-part:nth-child(1) > .body-content-part > ul').toArray()) {
            let title = $(`.info-bottom > a`, obj).text().trim();
            let subtitle = $(`.info-bottom > span`, obj).text().split(":")[0].trim();
            const image = $(`a > img`, obj).attr('src');
            let id = $(`.info-bottom > a`, obj).attr("href") ?? title;
            // if (!id || !subtitle) continue;
            hotItems.push(createMangaTile({
                id: id,
                image: image?.includes('http') ? image : (image?.includes('//') ? ('https:' + image.replace('//st.truyenchon.com', '//st.imageinstant.net')) : ('https://sayhentai.net/' + image)),
                title: createIconText({
                    text: title,
                }),
                subtitleText: createIconText({
                    text: subtitle,
                }),
            }))
        }
        hot.items = hotItems;
        sectionCallback(hot);

        //New Updates
        url = '';
        request = createRequestObject({
            url: 'https://sayhentai.net/',
            method: "GET",
        });
        let newUpdatedItems: MangaTile[] = [];
        data = await this.requestManager.schedule(request, 1);
        $ = this.cheerio.load(data.data);
        for (let obj of $('li', '#main-content > .wrap-content-part:nth-child(3) > .body-content-part > ul').toArray().splice(0, 15)) {
            let title = $(`.info-bottom > a`, obj).text().trim();
            let subtitle = $(`.info-bottom > span`, obj).text().split(":")[0].trim();
            const image = $(`a > img`, obj).attr('src');
            let id = $(`.info-bottom > a`, obj).attr("href") ?? title;
            // if (!id || !subtitle) continue;
            newUpdatedItems.push(createMangaTile({
                id: id,
                image: image?.includes('http') ? image : (image?.includes('//') ? ('https:' + image.replace('//st.truyenchon.com', '//st.imageinstant.net')) : ('https://sayhentai.net/' + image)),
                title: createIconText({
                    text: title,
                }),
                subtitleText: createIconText({
                    text: subtitle,
                }),
            }))
        }
        newUpdated.items = newUpdatedItems;
        sectionCallback(newUpdated);

        //New Added
        url = DOMAIN
        request = createRequestObject({
            url: 'https://sayhentai.net/',
            method: "GET",
        });
        let newAddItems: MangaTile[] = [];
        data = await this.requestManager.schedule(request, 1);
        $ = this.cheerio.load(data.data);
        for (let obj of $('li', '#main-content > .wrap-content-part:nth-child(5) > .body-content-part > ul').toArray()) {
            let title = $(`.info-bottom > a`, obj).text().trim();
            let subtitle = $(`.info-bottom > span`, obj).text().split(":")[0].trim();
            const image = $(`a > img`, obj).attr('src');
            let id = $(`.info-bottom > a`, obj).attr("href") ?? title;
            // if (!id || !subtitle) continue;
            newAddItems.push(createMangaTile({
                id: id,
                image: image?.includes('http') ? image : (image?.includes('//') ? ('https:' + image.replace('//st.truyenchon.com', '//st.imageinstant.net')) : ('https://sayhentai.net/' + image)),
                title: createIconText({
                    text: title,
                }),
                subtitleText: createIconText({
                    text: subtitle,
                }),
            }))
        }
        newAdded.items = newAddItems;
        sectionCallback(newAdded);
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page: number = metadata?.page ?? 1;
        let param = '';
        let url = '';
        switch (homepageSectionId) {
            case "hot":
                url = `https://sayhentai.net/danh-sach-truyen.html?status=0&sort=views&page=${page}`;
                break;
            case "new_updated":
                url = `https://sayhentai.net/danh-sach-truyen.html?page=${page}`;
                break;
            case "new_added":
                url = `https://sayhentai.net/danh-sach-truyen.html?status=0&sort=id&page=${page}`;
                break;
            default:
                return Promise.resolve(createPagedResults({ results: [] }))
        }

        const request = createRequestObject({
            url,
            method,
            param
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);

        const manga = parseViewMore($);
        metadata = !isLastPage($) ? { page: page + 1 } : undefined;
        return createPagedResults({
            results: manga,
            metadata,
        });
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1;
        const tags = query.includedTags?.map(tag => tag.id) ?? [];
        const request = createRequestObject({
            url: query.title ? encodeURI(`https://sayhentai.net/danh-sach-truyen.html?name=${query.title}`) :
                (tags[0] === 'all' ? 'https://sayhentai.net/danh-sach-truyen.html?' : encodeURI(`https://sayhentai.net/danh-sach-truyen.html?status=0&name=&genre=${tags[0]}&sort=last_update`)),
            method: "GET",
            param: encodeURI(`&page=${page}`)
        });

        const data = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(data.data);
        const tiles = parseSearch($);

        metadata = !isLastPage($) ? { page: page + 1 } : undefined;

        return createPagedResults({
            results: tiles,
            metadata
        });
    }

    async getSearchTags(): Promise<TagSection[]> {
        const tags: Tag[] = [
            {
                "id": "all",
                "label": "Tất cả"
            },
            {
                "id": "18",
                "label": "18+"
            },
            {
                "id": "action",
                "label": "Action"
            },
            {
                "id": "adult",
                "label": "Adult"
            },
            {
                "id": "adventure",
                "label": "Adventure"
            },
            {
                "id": "anime",
                "label": "Anime"
            },
            {
                "id": "chuyển sinh",
                "label": "Chuyển Sinh"
            },
            {
                "id": "comedy",
                "label": "Comedy"
            },
            {
                "id": "comic",
                "label": "Comic"
            },
            {
                "id": "cooking",
                "label": "Cooking"
            },
            {
                "id": "cổ đại",
                "label": "Cổ Đại"
            },
            {
                "id": "doujinshi",
                "label": "Doujinshi"
            },
            {
                "id": "drama",
                "label": "Drama"
            },
            {
                "id": "đam mỹ",
                "label": "Đam Mỹ"
            },
            {
                "id": "ecchi",
                "label": "Ecchi"
            },
            {
                "id": "fantasy",
                "label": "Fantasy"
            },
            {
                "id": "gender bender",
                "label": "Gender Bender"
            },
            {
                "id": "harem",
                "label": "Harem"
            },
            {
                "id": "historical",
                "label": "Historical"
            },
            {
                "id": "horror",
                "label": "Horror"
            },
            {
                "id": "isekai",
                "label": "Isekai"
            },
            {
                "id": "josei",
                "label": "Josei"
            },
            {
                "id": "live action",
                "label": "Live action"
            },
            {
                "id": "manga",
                "label": "Manga"
            },
            {
                "id": "manhua",
                "label": "Manhua"
            },
            {
                "id": "manhwa",
                "label": "Manhwa"
            },
            {
                "id": "martial arts",
                "label": "Martial Arts"
            },
            {
                "id": "mature",
                "label": "Mature"
            },
            {
                "id": "mecha",
                "label": "Mecha"
            },
            {
                "id": "mystery",
                "label": "Mystery"
            },
            {
                "id": "ngôn tình",
                "label": "Ngôn Tình"
            },
            {
                "id": "one shot",
                "label": "One shot"
            },
            {
                "id": "psychological",
                "label": "Psychological"
            },
            {
                "id": "romance",
                "label": "Romance"
            },
            {
                "id": "school life",
                "label": "School Life"
            },
            {
                "id": "sci-fi",
                "label": "Sci-fi"
            },
            {
                "id": "seinen",
                "label": "Seinen"
            },
            {
                "id": "shoujo",
                "label": "Shoujo"
            },
            {
                "id": "shoujo ai",
                "label": "Shoujo Ai"
            },
            {
                "id": "shounen",
                "label": "Shounen"
            },
            {
                "id": "shounen ai",
                "label": "Shounen Ai"
            },
            {
                "id": "slice of life",
                "label": "Slice of Life"
            },
            {
                "id": "smut",
                "label": "Smut"
            },
            {
                "id": "soft yaoi",
                "label": "Soft Yaoi"
            },
            {
                "id": "soft yuri",
                "label": "Soft Yuri"
            },
            {
                "id": "sports",
                "label": "Sports"
            },
            {
                "id": "supernatural",
                "label": "Supernatural"
            },
            {
                "id": "tragedy",
                "label": "Tragedy"
            },
            {
                "id": "trinh thám",
                "label": "Trinh Thám"
            },
            {
                "id": "truyện màu",
                "label": "Truyện Màu"
            },
            {
                "id": "webtoon",
                "label": "Webtoon"
            },
            {
                "id": "xuyên không",
                "label": "Xuyên Không"
            }
        ];

        const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'Thể Loại', tags: tags.map(x => createTag(x)) })]
        return tagSections;
    }

    globalRequestHeaders(): RequestHeaders { //cái này chỉ fix load ảnh thôi, ko load đc hết thì đéo phải do cái này
        return {
            referer: 'https://sayhentai.net/'
        }
    }
}