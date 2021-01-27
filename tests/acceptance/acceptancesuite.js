import UniversalPage from './pageobjects/universalpage';
import VerticalPage from './pageobjects/verticalpage';
import { setupServer, shutdownServer } from './server';
import FacetsPage from './pageobjects/facetspage';
import { Selector, RequestLogger } from 'testcafe';
import { browserBackButton, browserRefreshPage } from './utils';

const UNIVERSAL_PAGE = 'http://localhost:9999/tests/acceptance/fixtures/html/universal';
const VERTICAL_PAGE = 'http://localhost:9999/tests/acceptance/fixtures/html/vertical';
const FACETS_PAGE = 'http://localhost:9999/tests/acceptance/fixtures/html/facets';

/**
 * This file contains acceptance tests for a universal search page.
 * Note that before any tests are run, a local HTTP server is spun
 * up to serve the search page and the dist directory of Answers.
 * This server is closed once all tests have completed.
 */

fixture`Universal search page works as expected`
  .before(setupServer)
  .after(shutdownServer)
  .page`${UNIVERSAL_PAGE}`;

test('Basic universal flow', async t => {
  const searchComponent = UniversalPage.getSearchComponent();

  await searchComponent.enterQuery('Tom');
  await searchComponent.clearQuery();

  await searchComponent.enterQuery('ama');
  await searchComponent.getAutoComplete().selectOption('amani farooque phone number');

  const sections =
        await UniversalPage.getUniversalResultsComponent().getSections();
  await t.expect(sections.length).eql(2);

  const faqsSectionTitle = await sections[1].getTitle();
  await t.expect(faqsSectionTitle.toUpperCase()).contains('FAQ');
});

fixture`Vertical search page works as expected`
  .before(setupServer)
  .after(shutdownServer)
  .page`${VERTICAL_PAGE}`;

test('pagination flow', async t => {
  const searchComponent = VerticalPage.getSearchComponent();
  await searchComponent.enterQuery('Virginia');
  await searchComponent.submitQuery();
  const paginationComponent = VerticalPage.getPaginationComponent();
  await paginationComponent.clickNextButton();
  const pageNum = await paginationComponent.getActivePageLabelAndNumber();
  await t.expect(pageNum).eql('Page 2');
});

test('navigating and refreshing mantains that page number', async t => {
  await t.navigateTo(`${VERTICAL_PAGE}?query=Virginia`);

  const paginationComponent = VerticalPage.getPaginationComponent();
  await paginationComponent.clickNextButton();
  await browserRefreshPage();
  const pageNum = await paginationComponent.getActivePageLabelAndNumber();
  await t.expect(pageNum).eql('Page 2');
});

const spellCheckLogger = RequestLogger({
  url: /v2\/accounts\/me\/answers\/vertical\/query/
});
test.requestHooks(spellCheckLogger)('spell check flow', async t => {
  const searchComponent = VerticalPage.getSearchComponent();
  await searchComponent.enterQuery('varginia');
  await searchComponent.submitQuery();

  // Check that clicking spell check resets pagination to page 1
  const paginationComponent = VerticalPage.getPaginationComponent();
  await paginationComponent.clickNextButton();
  let pageNum = await paginationComponent.getActivePageLabelAndNumber();
  await t.expect(pageNum).eql('Page 2');

  const spellCheckComponent = VerticalPage.getSpellCheckComponent();
  await spellCheckComponent.clickLink();
  pageNum = await paginationComponent.getActivePageLabelAndNumber();
  await t.expect(pageNum).eql('Page 1');

  // Check that clicking spell check sends a queryTrigger=suggest url param
  // TODO(oshi) investigate making this an integration test
  const requestUrl = spellCheckLogger.requests[spellCheckLogger.requests.length - 1].request.url;
  const queryTriggerParam = new URLSearchParams(requestUrl).get('queryTrigger');
  await t.expect(queryTriggerParam).eql('suggest');
});

test('navigating pages and hitting the browser back button lands you on the right page', async t => {
  await t.navigateTo(`${VERTICAL_PAGE}?query=Virginia`);

  const paginationComponent = VerticalPage.getPaginationComponent();
  await paginationComponent.clickNextButton();
  await paginationComponent.clickNextButton();
  await browserBackButton();
  const pageNum = await paginationComponent.getActivePageLabelAndNumber();
  await t.expect(pageNum).eql('Page 2');
});

fixture`Facets page`
  .before(setupServer)
  .after(shutdownServer)
  .page`${FACETS_PAGE}`;

test(`Facets load on the page, and can affect the search`, async t => {
  const searchComponent = FacetsPage.getSearchComponent();
  await searchComponent.submitQuery();

  const facets = FacetsPage.getFacetsComponent();
  const filterBox = facets.getFilterBox();

  // Record the amount of results with no facets
  const verticalResultsComponent = FacetsPage.getVerticalResultsComponent();
  const initialResultsCount = await verticalResultsComponent.getResultsCountTotal();

  // Select the first option in the first FilterOptions
  const employeeDepartment = await filterBox.getFilterOptions('Employee Department');
  await employeeDepartment.toggleOption('Client Delivery');
  let expectedResultsCount = await employeeDepartment.getOptionCount('Client Delivery');

  await filterBox.applyFilters();

  // Get the actual number of results and check that it equals the expected amount
  let actualResultsCount = await verticalResultsComponent.getResultsCountTotal();
  await t.expect(actualResultsCount).eql(expectedResultsCount);

  // Reset the filters, and check that the number of results
  // is the same as the initial amount
  await filterBox.reset();
  await filterBox.applyFilters();
  actualResultsCount = await verticalResultsComponent.getResultsCountTotal();
  await t.expect(actualResultsCount).eql(initialResultsCount);

  // Select the first option and second option in the first FilterOptions
  await employeeDepartment.toggleOption('Client Delivery');
  await employeeDepartment.toggleOption('Technology');
  const clientDeliveryCount = await employeeDepartment.getOptionCount('Client Delivery');
  const technologyCount = await employeeDepartment.getOptionCount('Technology');
  expectedResultsCount = clientDeliveryCount + technologyCount;
  await filterBox.applyFilters();
  actualResultsCount = await verticalResultsComponent.getResultsCountTotal();
  await t.expect(actualResultsCount).eql(expectedResultsCount);

  // Check that selecting multiple FilterOptions works
  const brands = await filterBox.getFilterOptions('Puppy Preference');
  await brands.toggleOption('Frodo');
  expectedResultsCount = await brands.getOptionCount('Frodo');
  await filterBox.applyFilters();
  actualResultsCount = await verticalResultsComponent.getResultsCountTotal();
  await t.expect(actualResultsCount).eql(expectedResultsCount);

  // Reset the filters, and check that the number of results
  // is the same as the initial amount
  await filterBox.reset();
  await filterBox.applyFilters();
  actualResultsCount = await verticalResultsComponent.getResultsCountTotal();
  await t.expect(actualResultsCount).eql(initialResultsCount);
});

test(`static filterboxes`, async t => {
  const expectResultsCountToEql = async expectedCount => {
    const currentResultsCount = await verticalResultsComponent.getResultsCountTotal();
    await t.expect(currentResultsCount).eql(expectedCount);
  };
  const searchComponent = FacetsPage.getSearchComponent();
  await searchComponent.enterQuery('all');
  await searchComponent.submitQuery();
  const verticalResultsComponent = FacetsPage.getVerticalResultsComponent();
  const initialResultsCount = await verticalResultsComponent.getResultsCountTotal();

  const filterBox = FacetsPage.getStaticFilterBox();
  const radiusFilter = await filterBox.getFilterOptions('DISTANCE');
  const staticFilter = await filterBox.getFilterOptions('STATIC FILTERS');

  // Choose the 25 miles radius filter
  await radiusFilter.toggleOption('25 miles');
  const filterTags = Selector('.yxt-ResultsHeader-removableFilterTag');
  await t.expect(filterTags.count).eql(1);

  // Hit the back button, see the radius filter disappear
  await browserBackButton();
  await t.expect(filterTags.count).eql(0);
  await expectResultsCountToEql(initialResultsCount);

  // Click the 'Marty' checkbox and see it affect the search.
  // It should add 2 filter tags, one for the facet (from the backend)
  // and one for the static filter we just clicked
  await staticFilter.toggleOption('Marty');
  await t.expect(filterTags.count).eql(2);
  await expectResultsCountToEql(1);
  await t.expect(Selector('.yxt-StandardCard-title').innerText).eql('Liz Frailey');

  // Click the 'Frodo' checkbox and see it affect the search
  // It should add 2 filter tags, one for the facet (from the backend)
  // and one for the static filter we just clicked
  await staticFilter.toggleOption('Frodo');
  await t.expect(filterTags.count).eql(4);
  await expectResultsCountToEql(2);
  await t.expect(Selector('.yxt-StandardCard-title').nth(0).innerText).eql('Liz Frailey');
  await t.expect(Selector('.yxt-StandardCard-title').nth(1).innerText).eql('Sophia Kleyman');

  // Hit the back button, see the 'Frodo' filter disappear
  await browserBackButton();
  await t.expect(filterTags.count).eql(2);
  await expectResultsCountToEql(1);
  await t.expect(Selector('.yxt-StandardCard-title').innerText).eql('Liz Frailey');

  // Hit the back button, see the 'Marty' filter disappear and return to the 'all' search.
  await browserBackButton();
  await t.expect(filterTags.count).eql(0);
  await expectResultsCountToEql(initialResultsCount);
});

test(`filtersearch`, async t => {
  const filterSearch = FacetsPage.getFilterSearch();
  const filterTags = Selector('.yxt-ResultsHeader-removableFilterTag');

  // Choose the 'Virginia, United States' filter option
  await filterSearch.enterQuery('virginia');
  await filterSearch.selectFilter('Virginia, United States');
  await t.expect(filterTags.count).eql(1);
  let filterTagText = await filterTags.nth(0).find('.yxt-ResultsHeader-removableFilterValue').innerText;
  await t.expect(filterTagText).eql('Virginia, United States');

  // Choose the 'New York City, New York, United States' filter option
  await filterSearch.enterQuery('new york');
  await filterSearch.selectFilter('New York City, New York, United States');
  await t.expect(filterTags.count).eql(1);
  filterTagText = await filterTags.nth(0).find('.yxt-ResultsHeader-removableFilterValue').innerText;
  await t.expect(filterTagText).eql('New York City, New York, United States');

  // Hit the back button, expect to be back at the 'Virginia' filter state
  await browserBackButton();
  await t.expect(filterTags.count).eql(1);
  filterTagText = await filterTags.nth(0).find('.yxt-ResultsHeader-removableFilterValue').innerText;
  await t.expect(filterTagText).eql('Virginia, United States');

  // Test that refreshing the page will use the 'Virginia' filter
  await browserRefreshPage();
  await t.expect(filterTags.count).eql(1);
  filterTagText = await filterTags.nth(0).find('.yxt-ResultsHeader-removableFilterValue').innerText;
  await t.expect(filterTagText).eql('Virginia, United States');

  // Hit the back button, expect to be back at the initial state
  await browserBackButton();
  await t.expect(filterTags.count).eql(0);
});

test(`selecting a sort option and refreshing maintains that sort selection`, async t => {
  const searchComponent = FacetsPage.getSearchComponent();
  await searchComponent.submitQuery();

  const thirdSortOption = await Selector('.yxt-SortOptions-optionSelector').nth(2);
  await t.click(thirdSortOption);
  await browserRefreshPage();

  await t.expect(thirdSortOption.checked).ok();
});

fixture`Experience links work as expected`
  .before(setupServer)
  .after(shutdownServer)
  .page`${FACETS_PAGE}`;

test('Facets, pagination, and filters do not persist accross experience links', async t => {
  const verifyCleanLink = async (link) => {
    await t.expect(universalUrl).notContains('Facets');
    await t.expect(universalUrl).notContains('filter');
    await t.expect(universalUrl).notContains('search-offset');
  };

  // When you land, nav links should not have the Facets/filter/pagination parameters
  let universalUrl = await Selector('.js-yxt-navItem').nth(0).getAttribute('href');
  await t.expect(universalUrl).contains('universal');
  await t.expect(universalUrl).contains('referrerPageUrl');
  await verifyCleanLink(universalUrl);

  // When you search, nav links should not have the Facets/filter/pagination parameters
  const searchComponent = FacetsPage.getSearchComponent();
  await searchComponent.submitQuery();

  const facets = FacetsPage.getFacetsComponent();
  const filterBox = facets.getFilterBox();
  const employeeDepartment = await filterBox.getFilterOptions('Employee Department');
  await employeeDepartment.toggleOption('Client Delivery');
  await filterBox.applyFilters();

  universalUrl = await Selector('.js-yxt-navItem').nth(0).getAttribute('href');
  await t.expect(universalUrl).contains('referrerPageUrl');
  await verifyCleanLink(universalUrl);

  // When you apply sort options, nav links should be clean
  await t.click(await Selector('.yxt-SortOptions-optionSelector').nth(2)); // Click search option
  universalUrl = await Selector('.js-yxt-navItem').nth(0).getAttribute('href');
  await t.expect(universalUrl).contains('referrerPageUrl');
  await verifyCleanLink(universalUrl);

  // When you apply static filters, nav links should be clean
  await t.click(await Selector('.filterbox-container .js-yext-filter-option').nth(2)); // Click static filter
  universalUrl = await Selector('.js-yxt-navItem').nth(0).getAttribute('href');
  await t.expect(universalUrl).contains('referrerPageUrl');
  await verifyCleanLink(universalUrl);

  // When you navigate with pagination, nav links should not have the
  // Facets/filter/pagination parameters
  await searchComponent.enterQuery('all');
  await searchComponent.submitQuery();

  await t.click(await Selector('.js-yxt-navItem').nth(2)); // Go to vertical page
  await t.click(await Selector('.js-yxt-Pagination-next').nth(0)); // Page forward
  universalUrl = await Selector('.js-yxt-navItem').nth(0).getAttribute('href');
  await t.expect(universalUrl).contains('referrerPageUrl');
  await verifyCleanLink(universalUrl);

  // View All links AND Change Filters links should not have
  // Facets/filter/pagination parameters (though those components are not
  // allowed on universal currently)
  await t.click(await Selector('.js-yxt-navItem').nth(0)); // Go to universal page
  await searchComponent.clearQuery();
  await searchComponent.enterQuery('virginia');
  await searchComponent.submitQuery();

  const changeFiltersLink = await Selector('.yxt-ResultsHeader-changeFilters')
    .nth(0).getAttribute('href');
  await t.expect(changeFiltersLink).contains('referrerPageUrl');
  await verifyCleanLink(changeFiltersLink);

  const viewAllLink = await Selector('.yxt-Results-viewAllLink')
    .nth(0).getAttribute('href');
  await t.expect(viewAllLink).contains('referrerPageUrl');
  await verifyCleanLink(viewAllLink);
});

fixture`Performance marks on search`
  .before(setupServer)
  .after(shutdownServer)
  .page`${FACETS_PAGE}`;

test('window.performance calls are marked for a normal search', async t => {
  const marksToCheck = [
    'yext.answers.initStart',
    'yext.answers.statusStart',
    'yext.answers.statusEnd',
    'yext.answers.ponyfillStart',
    'yext.answers.ponyfillEnd',
    'yext.answers.verticalQueryStart',
    'yext.answers.verticalQuerySent',
    'yext.answers.verticalQueryResponseReceived',
    'yext.answers.verticalQueryResponseRendered'
  ];
  const searchComponent = FacetsPage.getSearchComponent();
  await searchComponent.submitQuery();

  // Wait for Results to be rendered
  const resultsSelector = await Selector('.yxt-Results');
  await resultsSelector.with({ visibilityCheck: true })();

  // All performance marks should be called at least once with a search
  for (let i = 0; i < marksToCheck.length; i++) {
    const markName = marksToCheck[i];
    const marksFoundWithName = await t.eval(() => {
      return JSON.stringify(window.performance.getEntriesByName(markName));
    }, { dependencies: { markName } });
    await t.expect(JSON.parse(marksFoundWithName.length)).gt(0);
  }
});

fixture`W3C Accessibility standards are met`
  .before(setupServer)
  .after(shutdownServer)
  .page`${FACETS_PAGE}`;

test('Sort options focus state works', async t => {
  const searchComponent = FacetsPage.getSearchComponent();
  await searchComponent.submitQuery();

  const firstOption = await Selector('.yxt-SortOptions-optionSelector').nth(0);

  await t.click(firstOption);
  await t.expect(firstOption.focused).ok();
});
