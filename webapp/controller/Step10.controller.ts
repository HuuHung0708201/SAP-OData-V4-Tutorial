import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import History from "sap/ui/core/routing/History";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import type ODataListBinding from "sap/ui/model/odata/v2/ODataListBinding";
import type ODataModelV2 from "sap/ui/model/odata/v2/ODataModel";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";
import type ResourceModel from "sap/ui/model/resource/ResourceModel";
import type Event from "sap/ui/base/Event";
import type Input from "sap/m/Input";
import { ValueState } from "sap/ui/core/library";
import Filter from "sap/ui/model/Filter";
import Sorter from "sap/ui/model/Sorter";
import FilterOperator from "sap/ui/model/FilterOperator";
import FilterType from "sap/ui/model/FilterType";
import type ListBinding from "sap/ui/model/ListBinding";
import Messaging from "sap/ui/core/Messaging";
import type Context from "sap/ui/model/Context";
import type Table from "sap/m/Table";
import type Message from "sap/ui/core/message/Message";
import type Control from "sap/ui/core/Control";
import type ListItemBase from "sap/m/ListItemBase";
import type FlexBox from "sap/m/FlexBox";
import type SearchField from "sap/m/SearchField";
import ResponsiveSplitter from "sap/ui/layout/ResponsiveSplitter";
import SplitPane from "sap/ui/layout/SplitPane";
import type SplitterLayoutData from "sap/ui/layout/SplitterLayoutData";

export default class Step10 extends Controller {
  // public override onInit(): void {
  //   let oData = {
  //     busy: false,
  //     order: 0,
  //   };
  //   let oModel = new JSONModel(oData);
  //   this.getView()?.setModel(oModel, "appView");
  // }

  private _bTechnicalErrors: boolean = false;

  public override onInit(): void {
    // Khởi tạo JSONModel cho appView
    const oData = {
      busy: false,
      hasUIChanges: false,
      usernameEmpty: false,
      order: 0,
    };
    const oAppViewModel = new JSONModel(oData);
    this.getView()?.setModel(oAppViewModel, "appView");

    // Lấy MessageModel
    const oMessageModel = Messaging.getMessageModel();
    this.getView()?.setModel(oMessageModel, "message");

    // Tạo ListBinding chỉ lấy các message technical (technical = true)
    const oMessageModelBinding = oMessageModel.bindList(
      "/", // path
      undefined, // context
      [], // sorter
      new Filter("technical", FilterOperator.EQ, true) // filter
    ) as ListBinding;

    // Attach sự kiện thay đổi cho binding
    oMessageModelBinding.attachChange(this.onMessageBindingChange, this);

    // Biến cờ technical errors
    this._bTechnicalErrors = false;
  }

  public onNavBack(): void {
    const history = History.getInstance();
    const previousHash = history.getPreviousHash();

    if (previousHash !== undefined) {
      window.history.go(-1);
    } else {
      const router = UIComponent.getRouterFor(this);
      router.navTo("RouteMain", {}, true);
    }
  }

  public async onRefresh(): Promise<void> {
    // Lấy JSONModel "appView" từ view, dùng để quản lý trạng thái UI (ví dụ: hasUIChanges)
    const appViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;

    // Kiểm tra nếu UI đang có thay đổi chưa lưu (hasUIChanges = true)
    // Nếu có, không cho phép refresh
    if (appViewModel?.getProperty("/hasUIChanges")) {
      // Lấy thông điệp lỗi từ i18n (async vì _getText trả Promise)
      const msg = await this._getText("refreshNotPossibleMessage");
      // Hiển thị hộp thoại lỗi cho người dùng
      MessageBox.error(msg);
      return; // thoát khỏi hàm, không refresh
    }

    // Lấy binding của Table theo id "peopleList" và path "items"
    const binding = this.byId("peopleList")?.getBinding("items") as ODataListBinding;

    // Nếu tìm thấy binding, refresh dữ liệu từ OData service
    if (binding) binding.refresh();

    // Lấy thông điệp thành công từ i18n
    const successMsg = await this._getText("refreshSuccessMessage");
    // Hiển thị thông báo toast cho người dùng
    MessageToast.show(successMsg);
  }

  // Helper async để lấy text từ i18n (có thể hỗ trợ đa ngôn ngữ)
  private async _getText(sTextId: string, aArgs?: any[]): Promise<string> {
    // Lấy ResourceModel i18n từ Component
    const oModel = this.getOwnerComponent()?.getModel("i18n") as ResourceModel;

    // Nếu không tìm thấy model → trả fallback là chính sTextId
    if (!oModel) {
      return sTextId;
    }

    try {
      // getResourceBundle trả về Promise<ResourceBundle>
      const oBundle = await oModel.getResourceBundle();

      // Lấy text từ bundle, nếu undefined thì fallback về sTextId
      return oBundle?.getText(sTextId, aArgs) ?? sTextId;
    } catch (err) {
      // Nếu có lỗi khi lấy bundle → fallback
      return sTextId;
    }
  }

  public onAgeChange(event: Event): void {
    // Lấy đối tượng Input mà người dùng vừa thay đổi từ event
    const input = event.getSource() as Input;

    // Lấy giá trị hiện tại của Input dưới dạng chuỗi
    const value = input.getValue(); // V2 không có event.getParameter("valid"), phải validate thủ công

    // Kiểm tra xem giá trị có phải là số nguyên dương hay không
    // Biểu thức /^\d+$/ sẽ chỉ match các chuỗi chỉ chứa chữ số 0-9 (không âm, không thập phân)
    if (!/^\d+$/.test(value)) {
      // Nếu không hợp lệ, hiển thị hộp thoại lỗi
      MessageBox.error("Age phải là số nguyên >= 0");

      // Đánh dấu trạng thái của Input là Error (màu đỏ, hiển thị lỗi)
      input.setValueState(ValueState.Error);

      // Thiết lập text hiển thị khi hover vào Input báo lỗi
      input.setValueStateText("Age phải là số nguyên >= 0");
    } else {
      // Nếu hợp lệ, xóa trạng thái lỗi, hiển thị bình thường
      input.setValueState(ValueState.None);
    }
  }

  // Hàm tìm kiếm theo LastName
  public onSearch(): void {
    // Lấy View hiện tại của Controller
    const view = this.getView();

    // Lấy control Input theo ID "searchField" và ép kiểu Input cho TypeScript
    const input = view?.byId("searchField") as Input | undefined;

    // Lấy giá trị người dùng nhập vào ô tìm kiếm, fallback là chuỗi rỗng nếu input undefined
    const value = input?.getValue() ?? "";

    // Tạo filter: tìm các bản ghi có LastName chứa giá trị nhập
    const filter = new Filter("LastName", FilterOperator.Contains, value);

    // Lấy binding của Table (sap.m.Table) theo ID "peopleList"
    const binding = view?.byId("peopleList")?.getBinding("items") as ListBinding | undefined;

    // Nếu binding tồn tại thì áp dụng filter ở mức ứng dụng
    if (binding) {
      binding.filter([filter], FilterType.Application);
    }
  }

  // Hàm sắp xếp LastName với trạng thái xoay vòng: none -> asc -> desc
  public async onSort(): Promise<void> {
    // Lấy View hiện tại
    const view = this.getView();

    // Mảng trạng thái sắp xếp: undefined = không sắp xếp, "asc" = tăng dần, "desc" = giảm dần
    const states: Array<undefined | "asc" | "desc"> = [undefined, "asc", "desc"];

    // Mảng key i18n tương ứng để hiển thị thông báo
    const aStateTextIds = ["sortNone", "sortAscending", "sortDescending"];

    // Lấy trạng thái hiện tại từ JSONModel appView
    const iOrder = (view?.getModel("appView")?.getProperty("/order") as number) ?? 0;

    // Tính trạng thái tiếp theo theo vòng lặp
    const iNextOrder = (iOrder + 1) % states.length;

    // Lấy trạng thái tiếp theo
    const sOrder = states[iNextOrder];

    // Lấy JSONModel của appView và cập nhật trạng thái order
    const oAppViewModel = view?.getModel("appView") as JSONModel | undefined;
    oAppViewModel?.setProperty("/order", iNextOrder);

    // Lấy binding của Table "peopleList"
    const oBinding = view?.byId("peopleList")?.getBinding("items") as ListBinding | undefined;

    // Nếu binding tồn tại, áp dụng sắp xếp theo LastName
    if (oBinding) {
      oBinding.sort(sOrder ? [new Sorter("LastName", sOrder === "desc")] : []);
    }

    // Chuỗi hiển thị trong thông báo (ví dụ tên cột LastName)
    const sLastName = "LastName";

    // Lấy i18n ResourceModel
    const oI18nModel = view?.getModel("i18n") as ResourceModel | undefined;

    // Khởi tạo message rỗng
    let sMessage = "";

    // Nếu model i18n tồn tại, lấy ResourceBundle và lấy text thông báo theo trạng thái
    if (oI18nModel) {
      const oBundle = await oI18nModel.getResourceBundle(); // Promise vì async
      sMessage = oBundle.getText(aStateTextIds[iNextOrder], [sLastName]) ?? "";
    }

    // Hiển thị thông báo toast
    MessageToast.show(sMessage);
  }

  private _setUIChanges(hasUIChanges?: boolean): void {
    // Nếu đang có lỗi kỹ thuật, buộc luôn đánh dấu UI có thay đổi
    if (this._bTechnicalErrors) {
      hasUIChanges = true;
    }
    // Nếu không truyền tham số hasUIChanges, tự động kiểm tra trạng thái pending changes
    else if (hasUIChanges === undefined) {
      // Lấy default OData model từ view
      const defaultModel = this.getView()?.getModel() as any;
      // Kiểm tra xem model có pending changes chưa submit không
      // Nếu có, hasUIChanges = true, ngược lại = false
      hasUIChanges = defaultModel?.hasPendingChanges?.() ?? false;
    }

    // Lấy JSONModel "appView" dùng để bind các trạng thái UI
    const appViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;
    // Cập nhật property /hasUIChanges trong model
    // Control nào bind thuộc tính enabled vào /hasUIChanges sẽ tự động enable/disable
    appViewModel?.setProperty("/hasUIChanges", hasUIChanges);
  }

  public onCreate(): void {
    // Lấy Table theo ID
    const list = this.byId("peopleList") as Table | undefined;
    if (!list) return;

    // Lấy binding của items
    const binding = list.getBinding("items") as ODataListBinding | undefined;
    if (!binding) return;

    // Tạo context mới
    const context: Context | undefined = binding.create({
      UserName: "",
      FirstName: "",
      LastName: "",
      Age: "18",
    });

    // Đánh dấu UI có thay đổi
    this._setUIChanges();

    // Cập nhật flag usernameEmpty trong appView model
    const oAppViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;
    oAppViewModel?.setProperty("/usernameEmpty", true);

    // Tìm item mới tạo và focus + chọn nó
    list.getItems().some((oItem) => {
      if (oItem.getBindingContext() === context) {
        oItem.focus();
        oItem.setSelected(true);
        return true; // dừng vòng lặp
      }
      return false;
    });
  }

  public onSave(): void {
    const oModel = this.getView()?.getModel() as ODataModelV2 | undefined;
    if (!oModel) return;

    this._setBusy(true); // lock UI

    oModel.submitChanges({
      groupId: "peopleGroup",
      success: async () => {
        // Sau khi commit thành công, pending changes = false
        this._setUIChanges(false);
        this._setBusy(false);

        const sMessage = await this._getText("changesSentMessage");
        MessageToast.show(sMessage);
      },
      error: (oError: { message: string }) => {
        this._setUIChanges(true); // vẫn coi là pending nếu lỗi
        this._setBusy(false);
        MessageBox.error(oError.message);
      },
    });

    // Reset technical errors
    this._bTechnicalErrors = false;
  }

  private _setBusy(bIsBusy: boolean): void {
    // Lấy JSONModel "appView"
    const oAppViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;

    // Cập nhật property /busy
    oAppViewModel?.setProperty("/busy", bIsBusy);
  }

  public onMessageBindingChange(oEvent: Event): void {
    // Lấy binding từ event source
    const oBinding = oEvent.getSource() as ListBinding;
    const aContexts = oBinding.getContexts() as Context[];

    // Cờ để đảm bảo MessageBox không mở nhiều lần
    let bMessageOpen = false;

    if (bMessageOpen || aContexts.length === 0) {
      return;
    }

    // Chuyển đổi các context thành instance Message
    const aMessages = aContexts.map((oContext) => oContext.getObject() as Message).filter(Boolean); // lọc undefined nếu có

    // Xóa các message khỏi MessageManager
    sap.ui.getCore().getMessageManager().removeMessages(aMessages);

    // Đánh dấu UI có thay đổi
    this._setUIChanges(true);
    this._bTechnicalErrors = true;

    // Hiển thị MessageBox lỗi
    MessageBox.error(aMessages[0].getMessage(), {
      id: "serviceErrorMessageBox",
      onClose: () => {
        bMessageOpen = false;
      },
    });

    bMessageOpen = true;
  }

  public onResetChanges(): void {
    // Lấy Table
    const oList = this.byId("peopleList") as Table | undefined;

    // Lấy binding items
    const oBinding = oList?.getBinding("items") as unknown as { resetChanges?: () => void };

    // Gọi resetChanges() nếu tồn tại
    oBinding?.resetChanges?.();

    // Reset cờ technical errors
    this._bTechnicalErrors = false;

    // Cập nhật UI changes flag
    this._setUIChanges();
  }

  public onInputChange(oEvt: Event): void {
    // Lấy control Input gây ra event
    const oInput = oEvt.getSource() as Input;

    // Kiểm tra nếu người dùng nhấn ESC (nếu event hỗ trợ)
    // TS không biết "escPressed", nên có thể dùng optional chaining
    const bEscPressed = (oEvt as any).getParameter?.("escPressed") as boolean | undefined;

    if (bEscPressed) {
      // Nếu ESC được nhấn, chỉ cập nhật UI changes flag mà không đánh dấu true
      this._setUIChanges();
    } else {
      // Lấy giá trị hiện tại từ Input
      const sUserName = oInput.getValue() || "";

      // Cập nhật UI changes flag
      this._setUIChanges(!!sUserName);

      // Cập nhật flag usernameEmpty trong appView model
      const oAppViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;
      oAppViewModel?.setProperty("/usernameEmpty", sUserName.trim() === "");
    }
  }

  private _setDetailArea(oContext?: Context | null): void {
    // Lấy vùng detail theo id="detailArea" (nơi hiển thị thông tin chi tiết)
    const oDetailArea = this.byId("detailArea") as Control | undefined;

    // Lấy layoutData theo id="defaultLayout" (dùng để thay đổi size + resizable)
    const oLayoutData = this.byId("defaultLayout") as SplitterLayoutData | undefined;

    // Lấy ô tìm kiếm theo id="searchField"
    const oSearchField = this.byId("searchField") as SearchField | undefined;

    // Nếu detailArea chưa tồn tại (ví dụ view đang bị destroy) → thoát
    if (!oDetailArea) {
      return;
    }

    // Lấy binding context cũ (nếu có) và tắt chế độ keepAlive của nó
    const oOldContext = oDetailArea.getBindingContext();
    if (oOldContext) {
      (oOldContext as any).setKeepAlive?.(false);
    }

    // Nếu có context mới → bật chế độ keepAlive
    if (oContext) {
      (oContext as any).setKeepAlive?.(
        true,
        // Callback: nếu entity bị refresh và không còn tồn tại → ẩn detail
        this._setDetailArea.bind(this)
      );
    }

    // Bind context mới (hoặc clear nếu không có)
    oDetailArea.setBindingContext((oContext ?? null) as any);

    // Hiển thị hoặc ẩn detail area
    oDetailArea.setVisible(!!oContext);

    if (oLayoutData) {
      // Resize layout: 60% khi có detail, 100% khi không có
      oLayoutData.setSize(oContext ? "60%" : "100%");
      oLayoutData.setResizable(!!oContext);
    }

    if (oSearchField) {
      // Điều chỉnh độ rộng của search field
      oSearchField.setWidth(oContext ? "40%" : "20%");
    }
  }

  public async onDelete(): Promise<void> {
    // Lấy Table theo id "peopleList" trong View
    const oTable = this.byId("peopleList") as Table | undefined;

    // Lấy item đang được chọn trong Table
    const oSelected = oTable?.getSelectedItem();
    if (!oSelected) return; // Nếu không có item nào được chọn thì thoát hàm

    // Lấy binding context (dữ liệu model) của item được chọn
    const oContext = oSelected.getBindingContext();
    if (!oContext) return; // Nếu không có context thì thoát hàm

    // Lấy đường dẫn (path) của entity trong ODataModel, ví dụ: "/People('ID_001')"
    const sPath = oContext.getPath();

    // Lấy giá trị "UserName" từ context để đưa vào thông báo
    const sUserName = oContext.getProperty("UserName") as string | undefined;

    // Lấy OData V2 Model từ View
    const oModel = this.getView()?.getModel() as ODataModelV2 | undefined;
    if (!oModel) return; // Nếu không có model thì thoát hàm

    // Trước khi xoá → clear khu vực chi tiết & đánh dấu UI đang có thay đổi
    this._setDetailArea();
    this._setUIChanges(true);
    this._setBusy(true); // Khóa UI (disable nút bấm) để tránh thao tác lặp

    try {
      // Gọi phương thức remove() của ODataModel để xoá entity
      await new Promise<void>((resolve, reject) => {
        oModel.remove(sPath, {
          groupId: "$direct", // Gửi request ngay lập tức (không dùng batch)
          success: () => resolve(), // Nếu xoá thành công thì resolve Promise
          error: (oError: { message: string; canceled?: boolean }) => reject(oError), // Nếu lỗi thì reject Promise
        });
      });

      // Nếu xoá thành công → lấy text từ i18n với key "deletionSuccessMessage"
      const sMsg = await this._getText("deletionSuccessMessage", [sUserName]);
      MessageToast.show(sMsg); // Hiển thị thông báo thành công dạng Toast

      // Đánh dấu UI không còn thay đổi (vì dữ liệu đã xoá thành công)
      this._setUIChanges(false);
    } catch (oError: any) {
      // Nếu xoá lỗi → kiểm tra xem item hiện tại có còn là item đang chọn không
      // Nếu có thì load lại detail area để hiển thị dữ liệu
      if (oContext === oTable?.getSelectedItem()?.getBindingContext()) {
        this._setDetailArea(oContext);
      }

      // Đánh dấu UI có thay đổi chưa lưu
      this._setUIChanges(true);

      // Nếu người dùng cancel (hủy thao tác xoá từ MessageBox confirm)
      if (oError.canceled) {
        // Hiện thông báo restore từ i18n
        const sMsg = await this._getText("deletionRestoredMessage", [sUserName]);
        MessageToast.show(sMsg);
        return; // Thoát sớm, không hiển thị lỗi
      }

      // Nếu là lỗi khác (không phải canceled) → hiển thị MessageBox error
      MessageBox.error(`${oError.message}: ${sUserName}`);
    } finally {
      // Cuối cùng → mở lại UI (enable nút bấm)
      this._setBusy(false);
    }
  }

  public async onResetDataSource(): Promise<void> {
    const oTable = this.byId("peopleList") as Table | undefined;
    const oModel = this.getView()?.getModel() as ODataModelV2 | undefined;

    if (!oTable || !oModel) {
      MessageBox.warning("Không tìm thấy Table hoặc Model.");
      return;
    }

    this._setBusy(true);

    try {
      // Nếu dùng mock server, chỉ refresh binding để reload dữ liệu
      const oBinding = oTable.getBinding("items") as ODataListBinding | undefined;
      if (oBinding) {
        oBinding.refresh(true); // reload dữ liệu từ mock OData
      }

      // Nếu là OData thật, cũng refresh binding
      // => giữ nguyên binding gốc, không tạo JSONModel mới
      this._setUIChanges(false);

      const sMsg = await this._getText("sourceResetSuccessMessage");
      MessageToast.show(sMsg);
    } catch (oError: any) {
      MessageBox.error(oError.message || "Lỗi khi reset dữ liệu.");
    } finally {
      this._setBusy(false);
    }
  }

  public onSelectionChange(event: Event & { getParameter(name: "listItem"): ListItemBase }): void {
    // Lấy listItem được chọn từ event
    const oListItem = event.getParameter("listItem");

    // Lấy binding context của listItem
    const oContext = oListItem.getBindingContext() as Context;

    // Gọi helper để bind detail area
    this._setDetailArea(oContext);
  }
}

// ListItemBase = lớp cha chung cho mọi loại item trong sap.m.List và sap.m.Table.
// Bạn import nó khi muốn viết code generic mà không quan tâm loại item cụ thể là gì.
// Nó giúp bạn có typing an toàn trong TypeScript khi gọi getBindingContext() hay các API khác.
